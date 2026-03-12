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
        General-purpose chat. Uses Claude to interpret the message,
        then optionally dispatches a workflow.
        """
        claude = self.get_tool("claude")
        message = input.parameters.get("message", input.intent)

        # Get user context from memory
        user_context = await self.memory.get_context(input.workflow_id or input.task_id)

        response = await claude.execute(
            system=(
                "You are Fabric AI, a personal AI chief of staff. "
                "You help the user manage their email, calendar, tasks, and research. "
                "Be concise, helpful, and proactive. "
                "If the user wants to take an action (e.g., 'triage my inbox', 'prepare for tomorrow'), "
                "acknowledge that you're on it and describe what you'll do. "
                f"User context: {user_context}"
            ),
            prompt=message,
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=response.success,
            result={"response": response.data, "message": message},
            error=response.error,
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
