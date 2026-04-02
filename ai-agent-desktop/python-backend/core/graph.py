"""
LangGraph conversational engine — Phase 2.

Replaces the ad-hoc _pending_action dict on AssistantAgent with a proper
stateful graph.  MemorySaver checkpoints each conversation thread so:
  • Concurrent users never share state (each conversation_id is isolated).
  • Pending confirmations survive across requests within the same thread.
  • Thread history is queryable via graph.aget_state(config).

Graph topology
──────────────
  START → entry_router ─► chat               → END
                        └► handle_confirmation → END
"""

import uuid
from typing import TypedDict, Annotated, Optional
import operator

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from observability.logger import get_logger

_logger = get_logger("langgraph")


# ── State ─────────────────────────────────────────────────────────────────────

class FabricState(TypedDict):
    """Persistent state for a single conversation thread (keyed by conversation_id)."""
    user_message: str
    action: str                         # classified intent from last turn
    pending_action: Optional[dict]      # staged destructive action awaiting confirmation
    awaiting_confirmation: bool         # True when we're waiting for yes/no
    confirmation_prompt: str            # the prompt shown to the user
    response: str                       # response to return to the client
    workflow_id: str
    conversation_id: str
    user_id: str
    # Conversation history — reducer appends each turn's messages
    messages: Annotated[list[dict], operator.add]


# ── Router ────────────────────────────────────────────────────────────────────

def _decide_entry(state: FabricState) -> str:
    """Decide where to start based on whether a confirmation is pending."""
    if state.get("awaiting_confirmation") and state.get("pending_action"):
        return "handle_confirmation"
    return "chat"


# ── Nodes ─────────────────────────────────────────────────────────────────────

async def _chat_node(state: FabricState, assistant_agent) -> dict:
    """
    Main chat node.  Calls AssistantAgent with _from_graph=True so the agent
    returns needs_confirmation + pending_action in its result instead of
    storing them on self._pending_action.
    """
    from models.messages import AgentInput

    agent_input = AgentInput(
        task_id=str(uuid.uuid4()),
        workflow_id=state.get("workflow_id") or str(uuid.uuid4()),
        intent="user_chat",
        parameters={
            "message": state["user_message"],
            "conversation_id": state.get("conversation_id", "default"),
            "_from_graph": True,
        },
        user_id=state.get("user_id", "default"),
    )

    result = await assistant_agent.execute(agent_input)

    updates: dict = {}
    if result.success and isinstance(result.result, dict):
        data = result.result
        response = data.get("response", "")

        if data.get("needs_confirmation") and data.get("pending_action"):
            updates = {
                "pending_action": data["pending_action"],
                "awaiting_confirmation": True,
                "confirmation_prompt": response,
                "response": response,
            }
        else:
            updates = {
                "response": response,
                "pending_action": None,
                "awaiting_confirmation": False,
            }
    else:
        updates = {
            "response": result.error or "Something went wrong.",
            "pending_action": None,
            "awaiting_confirmation": False,
        }

    updates["messages"] = [
        {"role": "user",      "content": state["user_message"]},
        {"role": "assistant", "content": updates.get("response", "")},
    ]
    return updates


async def _handle_confirmation_node(state: FabricState, assistant_agent) -> dict:
    """
    Process a yes/no reply to a staged destructive action.
    On confirm: delegates to assistant_agent.execute_confirmed().
    On cancel or ambiguous: clears the pending action.
    """
    message = state.get("user_message", "").strip().lower()

    confirmed = message in {
        "yes", "y", "confirm", "proceed", "do it",
        "go ahead", "ok", "okay", "sure", "yep", "yup",
    }
    cancelled = message in {
        "no", "n", "cancel", "stop", "abort",
        "nope", "nah", "don't", "dont",
    }

    base_updates = {"pending_action": None, "awaiting_confirmation": False}

    if cancelled:
        response = "Cancelled. No changes were made."
        return {
            **base_updates,
            "response": response,
            "messages": [
                {"role": "user",      "content": state["user_message"]},
                {"role": "assistant", "content": response},
            ],
        }

    if confirmed and state.get("pending_action"):
        from models.messages import AgentInput

        agent_input = AgentInput(
            task_id=str(uuid.uuid4()),
            workflow_id=state.get("workflow_id") or str(uuid.uuid4()),
            intent="user_chat",
            parameters={
                "message": state["user_message"],
                "conversation_id": state.get("conversation_id", "default"),
                "_from_graph": True,
            },
            user_id=state.get("user_id", "default"),
        )

        try:
            result = await assistant_agent.execute_confirmed(agent_input, state["pending_action"])
            response = (
                result.result.get("response", "Done.")
                if result.success
                else result.error or "Something went wrong."
            )
        except Exception as e:
            _logger.error(f"execute_confirmed failed: {e}")
            response = f"Error executing action: {e}"

        return {
            **base_updates,
            "response": response,
            "messages": [
                {"role": "user",      "content": state["user_message"]},
                {"role": "assistant", "content": response},
            ],
        }

    # Ambiguous response — clear and inform user
    response = "I'll take that as a no. No changes were made."
    return {
        **base_updates,
        "response": response,
        "messages": [
            {"role": "user",      "content": state["user_message"]},
            {"role": "assistant", "content": response},
        ],
    }


# ── Graph factory ─────────────────────────────────────────────────────────────

def build_graph(assistant_agent):
    """
    Compile the LangGraph conversation graph, binding the AssistantAgent.

    Returns the compiled graph.  Each unique conversation_id becomes its own
    thread in the MemorySaver checkpointer.
    """
    checkpointer = MemorySaver()

    # Bind agent into closures so nodes are plain callables
    async def chat_node(state: FabricState):
        return await _chat_node(state, assistant_agent)

    async def handle_confirmation_node(state: FabricState):
        return await _handle_confirmation_node(state, assistant_agent)

    def entry_router(state: FabricState):
        return {}   # no state mutation — only used for conditional routing

    builder = StateGraph(FabricState)
    builder.add_node("entry_router",        entry_router)
    builder.add_node("chat",                chat_node)
    builder.add_node("handle_confirmation", handle_confirmation_node)

    builder.set_entry_point("entry_router")
    builder.add_conditional_edges(
        "entry_router",
        _decide_entry,
        {"chat": "chat", "handle_confirmation": "handle_confirmation"},
    )
    builder.add_edge("chat",                END)
    builder.add_edge("handle_confirmation", END)

    graph = builder.compile(checkpointer=checkpointer)
    _logger.info("LangGraph conversation graph compiled")
    return graph
