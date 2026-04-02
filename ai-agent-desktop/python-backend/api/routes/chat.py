"""
Chat API route.

When the LangGraph graph is available (Phase 2), POST /api/v1/chat returns
the assistant's response synchronously in the HTTP reply — no need to poll
the WebSocket for the result.

Falls back to the orchestrator queue (original behaviour) if the graph is
not yet initialised, preserving full backward compatibility.
"""

import uuid
from fastapi import APIRouter
from pydantic import BaseModel

from observability.logger import get_logger

_logger = get_logger("chat_route")

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = "default"
    user_id: str = "default"


def make_router(orchestrator, graph=None):
    @router.post("")
    async def chat(req: ChatRequest):
        # ── LangGraph path (Phase 2) — synchronous response ──────────────────
        if graph is not None:
            config = {"configurable": {"thread_id": req.conversation_id}}
            try:
                result = await graph.ainvoke(
                    {
                        "user_message": req.message,
                        "conversation_id": req.conversation_id,
                        "user_id": req.user_id,
                        "workflow_id": req.conversation_id,
                        # Only pass per-message fields.
                        # State fields like awaiting_confirmation and pending_action
                        # are owned by the MemorySaver checkpointer — passing them
                        # here would overwrite the checkpointed values and break
                        # the confirmation loop.
                    },
                    config=config,
                )
                return {
                    "response": result.get("response", ""),
                    "awaiting_confirmation": result.get("awaiting_confirmation", False),
                    "conversation_id": req.conversation_id,
                }
            except Exception as e:
                _logger.error(f"LangGraph chat error: {e}", exc_info=True)
                # Fall through to orchestrator on graph failure

        # ── Legacy orchestrator path — async (result via WebSocket) ──────────
        task_id = await orchestrator.dispatch(
            intent="user_chat",
            parameters={"message": req.message, "conversation_id": req.conversation_id},
            agent_name="assistant_agent",
        )
        return {"task_id": task_id, "status": "processing"}

    return router
