from datetime import datetime, timedelta
from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput, AgentAction
from models.events import Event, EventType


class CalendarAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "calendar_agent"

    @property
    def description(self) -> str:
        return "Manages Google Calendar: fetch events, prep meeting briefs, detect conflicts, create events"

    @property
    def capabilities(self) -> list[str]:
        return [
            "get_today_meetings", "get_tomorrow_meetings", "create_event",
            "meeting_prep", "conflict_detection", "schedule_response_times",
        ]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "get_today_meetings": self._get_today_meetings,
            "get_tomorrow_meetings": self._get_tomorrow_meetings,
            "create_event": self._create_event,
            "meeting_prep": self._meeting_prep,
            "schedule_response_times": self._schedule_response_times,
        }
        handler = dispatch.get(input.intent)
        if not handler:
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=False,
                error=f"Unknown intent: {input.intent}",
            )
        return await handler(input)

    async def _get_today_meetings(self, input: AgentInput) -> AgentOutput:
        cal = self.get_tool("calendar")
        today = datetime.now().date().isoformat()
        result = await cal.execute(action="list_events", date=today)
        if not result.success:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error=result.error)

        meetings = result.data
        await self.memory.set_context(
            input.workflow_id or input.task_id, "calendar_agent", {"meetings": meetings}
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"meetings": meetings, "count": len(meetings)},
        )

    async def _get_tomorrow_meetings(self, input: AgentInput) -> AgentOutput:
        cal = self.get_tool("calendar")
        tomorrow = (datetime.now().date() + timedelta(days=1)).isoformat()
        result = await cal.execute(action="list_events", date=tomorrow)
        if not result.success:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error=result.error)

        meetings = result.data
        await self.memory.set_context(
            input.workflow_id or input.task_id, "calendar_agent", {"meetings": meetings}
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"meetings": meetings, "count": len(meetings)},
        )

    async def _create_event(self, input: AgentInput) -> AgentOutput:
        cal = self.get_tool("calendar")
        p = input.parameters
        result = await cal.execute(
            action="create_event",
            title=p.get("title", "New Event"),
            date=p.get("date"),
            start_time=p.get("start_time"),
            end_time=p.get("end_time"),
            description=p.get("description", ""),
        )
        if result.success:
            await self._event_bus.publish(Event(
                type=EventType.MEETING_SCHEDULED,
                payload=result.data,
                source=self.name,
                workflow_id=input.workflow_id,
            ))
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=result.success,
            result=result.data, error=result.error,
            events_emitted=[EventType.MEETING_SCHEDULED] if result.success else [],
        )

    async def _meeting_prep(self, input: AgentInput) -> AgentOutput:
        cal = self.get_tool("calendar")
        claude = self.get_tool("claude")

        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])
        research = (input.context.get("research_agent") or {}).get("participants", [])
        threads = (input.context.get("email_agent") or {}).get("related_threads", [])

        brief = await claude.execute(
            system="You are an executive assistant. Create a concise meeting preparation brief.",
            prompt=(
                f"Meetings: {meetings}\n\n"
                f"Participant research: {research}\n\n"
                f"Related email threads: {threads}\n\n"
                "Create a meeting prep brief with: key attendees, agenda hints, relevant context, and talking points."
            ),
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=brief.success,
            result={"brief": brief.data, "meetings": meetings},
        )

    async def _schedule_response_times(self, input: AgentInput) -> AgentOutput:
        cal = self.get_tool("calendar")
        today = datetime.now().date().isoformat()
        result = await cal.execute(action="list_events", date=today)
        busy_times = [e["time"] for e in (result.data or []) if e.get("time") != "All day"]

        # Simple heuristic: suggest 30-min slots not in busy_times
        all_slots = [f"{h:02d}:00" for h in range(9, 18)]
        free_slots = [s for s in all_slots if s not in busy_times][:3]

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"suggested_response_times": free_slots},
        )
