import asyncio
import json
from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput


class AssistantAgent(BaseAgent):
    """
    User-facing conversational agent.
    Interprets free-form user commands, plans multi-agent workflows,
    and compiles results into natural language responses.
    Never calls other agents directly — uses the orchestrator.
    """

    def __init__(self, tool_registry, memory, event_bus, orchestrator):
        super().__init__(tool_registry, memory, event_bus)
        self._orchestrator = orchestrator

    @property
    def name(self) -> str:
        return "assistant_agent"

    @property
    def description(self) -> str:
        return "User-facing AI chief of staff — chat, planning, workflow coordination"

    @property
    def capabilities(self) -> list[str]:
        return [
            "user_chat", "workflow_planning", "compile_briefing",
            "compile_daily_summary", "compile_morning_briefing",
        ]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "compile_briefing": self._compile_briefing,
            "compile_daily_summary": self._compile_daily_summary,
            "compile_morning_briefing": self._compile_morning_briefing,
            "user_chat": self._user_chat,
        }
        handler = dispatch.get(input.intent, self._user_chat)
        return await handler(input)

    async def _user_chat(self, input: AgentInput) -> AgentOutput:
        """
        Parse the user's free-form message into a structured action using Claude,
        then execute it — dispatch to specialist agents or answer directly.
        """
        claude = self.get_tool("claude")
        message = input.parameters.get("message", input.intent)

        # Step 1: classify intent
        parse_result = await claude.execute(
            system=(
                "You are an intent router for a personal AI chief of staff. "
                "Classify the user request and return ONLY a valid JSON object — no markdown, no explanation:\n"
                "{\n"
                '  "action": "answer" | "draft_email" | "workflow" | "search" | "create_task" | "calendar",\n'
                '  "workflow": null | "morning_routine" | "handle_inbox" | "daily_summary" | "prepare_for_tomorrow",\n'
                '  "to": null | "recipient name or email",\n'
                '  "subject": null | "email subject",\n'
                '  "body": null | "email body text",\n'
                '  "query": null | "search query or task title",\n'
                '  "direct_answer": null | "short direct answer when action is answer"\n'
                "}\n"
                "Examples:\n"
                "- 'Email John about the meeting tomorrow' → {\"action\":\"draft_email\",\"to\":\"John\",\"subject\":\"Meeting tomorrow\",\"body\":\"...\", ...}\n"
                "- 'Prepare me for tomorrow' → {\"action\":\"workflow\",\"workflow\":\"prepare_for_tomorrow\", ...}\n"
                "- 'Search for Python async tips' → {\"action\":\"search\",\"query\":\"Python async tips\", ...}\n"
                "- 'Add a task to review the Q1 report' → {\"action\":\"create_task\",\"query\":\"Review Q1 report\", ...}\n"
                "- 'What is the capital of France?' → {\"action\":\"answer\",\"direct_answer\":\"Paris.\", ...}"
            ),
            prompt=message,
            as_json=True,
        )

        # Fallback to plain conversational response if JSON parsing failed
        if not parse_result.success or not isinstance(parse_result.data, dict):
            conv = await claude.execute(
                system="You are Fabric AI, a personal AI chief of staff. Be concise and helpful.",
                prompt=message,
            )
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=True,
                result={"response": conv.data or "I'm here — could you rephrase that?", "message": message},
            )

        action = parse_result.data.get("action", "answer")
        response_text = ""

        if action == "draft_email":
            to = parse_result.data.get("to") or ""
            subject = parse_result.data.get("subject") or ""
            body = parse_result.data.get("body") or ""
            await self._orchestrator.dispatch(
                intent="draft_reply",
                parameters={"to": to, "subject": subject, "body": body},
                agent_name="email_agent",
                workflow_id=input.workflow_id,
            )
            response_text = (
                f"Drafting an email to {to or 'the recipient'} — "
                f"subject: '{subject or '(untitled)'}'. Email Agent is on it."
            )

        elif action == "workflow":
            workflow = parse_result.data.get("workflow")
            labels = {
                "morning_routine": "Morning Briefing",
                "handle_inbox": "Handle Inbox",
                "daily_summary": "Daily Summary",
                "prepare_for_tomorrow": "Prepare for Tomorrow",
            }
            if workflow and workflow in labels:
                asyncio.create_task(self._orchestrator.run_named_workflow(workflow))
                response_text = (
                    f"Starting {labels[workflow]} — your agents are working on it. "
                    "Watch the event feed for progress."
                )
            else:
                response_text = (
                    "I'm not sure which workflow you mean. "
                    "Options: Morning Briefing, Handle Inbox, Daily Summary, Prepare for Tomorrow."
                )

        elif action == "search":
            query = parse_result.data.get("query") or message
            await self._orchestrator.dispatch(
                intent="web_search",
                parameters={"query": query},
                agent_name="research_agent",
                workflow_id=input.workflow_id,
            )
            response_text = f"Searching for '{query}'. Research Agent is on it — results will appear in the event feed."

        elif action == "create_task":
            title = parse_result.data.get("query") or message
            await self._orchestrator.dispatch(
                intent="create_task",
                parameters={"title": title},
                agent_name="task_agent",
                workflow_id=input.workflow_id,
            )
            response_text = f"Creating task: '{title}'. Task Agent has it."

        elif action == "calendar":
            await self._orchestrator.dispatch(
                intent="get_today_meetings",
                parameters={},
                agent_name="calendar_agent",
                workflow_id=input.workflow_id,
            )
            response_text = "Fetching your schedule. Calendar Agent is checking your meetings."

        else:  # "answer"
            direct = parse_result.data.get("direct_answer")
            if direct:
                response_text = direct
            else:
                conv = await claude.execute(
                    system="You are Fabric AI, a personal AI chief of staff. Answer concisely and helpfully.",
                    prompt=message,
                )
                response_text = conv.data or "I'm here to help — could you elaborate?"

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"response": response_text, "message": message},
        )

    async def _compile_briefing(self, input: AgentInput) -> AgentOutput:
        """Synthesize all prior workflow step results into a meeting prep brief."""
        claude = self.get_tool("claude")

        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])
        participants = (input.context.get("research_agent") or {}).get("participants", [])
        threads = (input.context.get("email_agent") or {}).get("related_threads", [])
        tasks = (input.context.get("task_agent") or {}).get("relevant_tasks", [])

        brief = await claude.execute(
            system=(
                "You are an executive assistant creating a concise meeting preparation brief. "
                "Format with clear sections. Be actionable and scannable."
            ),
            prompt=(
                f"Tomorrow's meetings: {json.dumps(meetings, default=str)}\n\n"
                f"Participant backgrounds: {json.dumps(participants, default=str)}\n\n"
                f"Related email threads: {threads}\n\n"
                f"Relevant tasks: {tasks}\n\n"
                "Create a professional meeting prep brief."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=brief.success,
            result={"briefing": brief.data, "meetings_count": len(meetings)},
        )

    async def _compile_daily_summary(self, input: AgentInput) -> AgentOutput:
        claude = self.get_tool("claude")

        email_data = input.context.get("email_agent") or {}
        calendar_data = input.context.get("calendar_agent") or {}
        task_data = input.context.get("task_agent") or {}

        summary = await claude.execute(
            system=(
                "You are an executive assistant. Create a concise daily summary. "
                "Use bullet points and be actionable."
            ),
            prompt=(
                f"Email summary: {email_data.get('summary', 'No data')}\n\n"
                f"Today's meetings: {calendar_data.get('meetings', [])}\n\n"
                f"Overdue tasks: {task_data.get('overdue_tasks', [])}\n\n"
                "Create a 5-bullet daily summary with priorities."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=summary.success,
            result={"summary": summary.data},
        )

    async def _compile_morning_briefing(self, input: AgentInput) -> AgentOutput:
        claude = self.get_tool("claude")

        from datetime import datetime
        calendar_data = input.context.get("calendar_agent") or {}
        email_data = input.context.get("email_agent") or {}
        task_data = input.context.get("task_agent") or {}

        greeting = await claude.execute(
            system=(
                "You are Fabric AI, an upbeat and helpful personal AI chief of staff. "
                "Create an energizing morning briefing. Be friendly and concise."
            ),
            prompt=(
                f"Good morning! Today is {datetime.now().strftime('%A, %B %d')}.\n\n"
                f"Today's meetings ({len(calendar_data.get('meetings', []))}): {calendar_data.get('meetings', [])}\n\n"
                f"Email inbox: {email_data.get('summary', 'No email data')}\n\n"
                f"High priority tasks: {task_data.get('high_priority_tasks', [])}\n\n"
                "Write a concise morning briefing covering: schedule, inbox status, top priorities."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=greeting.success,
            result={"briefing": greeting.data},
        )
