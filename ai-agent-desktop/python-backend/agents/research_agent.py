from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput
from models.events import Event, EventType


class ResearchAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "research_agent"

    @property
    def description(self) -> str:
        return "Web research: search topics, summarize findings, research meeting participants"

    @property
    def capabilities(self) -> list[str]:
        return ["web_search", "summarize_topic", "research_participants", "research_company"]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "web_search": self._web_search,
            "summarize_topic": self._summarize_topic,
            "research_participants": self._research_participants,
            "research_company": self._research_company,
        }
        handler = dispatch.get(input.intent)
        if not handler:
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=False,
                error=f"Unknown intent: {input.intent}",
            )
        return await handler(input)

    async def _web_search(self, input: AgentInput) -> AgentOutput:
        search = self.get_tool("search")
        query = input.parameters.get("query", "")
        if not query:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error="query is required")

        result = await search.execute(query=query, max_results=5)
        if not result.success:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error=result.error)

        # Summarize with Claude
        claude = self.get_tool("claude")
        summary = await claude.execute(
            system="You are a research assistant. Summarize search results concisely.",
            prompt=f"Query: {query}\n\nResults:\n{result.data}\n\nProvide a 3-5 sentence summary.",
        )

        await self._event_bus.publish(Event(
            type=EventType.RESEARCH_COMPLETED,
            payload={"query": query, "results_count": len(result.data.get("results", []))},
            source=self.name,
            workflow_id=input.workflow_id,
        ))

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={
                "query": query,
                "results": result.data.get("results", []),
                "summary": summary.data,
            },
            events_emitted=[EventType.RESEARCH_COMPLETED],
        )

    async def _summarize_topic(self, input: AgentInput) -> AgentOutput:
        search = self.get_tool("search")
        claude = self.get_tool("claude")
        topic = input.parameters.get("topic", "")

        search_result = await search.execute(query=topic, max_results=5)
        summary = await claude.execute(
            system="You are a research assistant. Create a comprehensive but concise summary.",
            prompt=f"Topic: {topic}\n\nSources:\n{search_result.data}\n\nSummarize in structured format with key points.",
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"topic": topic, "summary": summary.data},
        )

    async def _research_participants(self, input: AgentInput) -> AgentOutput:
        """Research attendees of upcoming meetings."""
        search = self.get_tool("search")
        claude = self.get_tool("claude")

        # Get meetings from prior workflow step context
        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])
        all_attendees = []
        for meeting in meetings:
            all_attendees.extend(meeting.get("attendees", []))

        # Deduplicate
        attendees = list(set(all_attendees))[:5]  # limit API calls

        participants = []
        for attendee in attendees:
            result = await search.execute(query=f"{attendee} professional background", max_results=2)
            summary = await claude.execute(
                prompt=f"Summarize what you know about: {attendee}\n\nSearch results: {result.data}",
                system="Be brief (2-3 sentences). Focus on professional context.",
            )
            participants.append({"name": attendee, "summary": summary.data})

        await self.memory.set_context(
            input.workflow_id or input.task_id, "research_agent", {"participants": participants}
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"participants": participants},
        )

    async def _research_company(self, input: AgentInput) -> AgentOutput:
        search = self.get_tool("search")
        claude = self.get_tool("claude")
        company = input.parameters.get("company", "")

        result = await search.execute(query=f"{company} company overview news", max_results=5)
        summary = await claude.execute(
            system="You are a business analyst. Provide a concise company brief.",
            prompt=f"Research report for: {company}\n\nSources:\n{result.data}",
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"company": company, "brief": summary.data},
        )
