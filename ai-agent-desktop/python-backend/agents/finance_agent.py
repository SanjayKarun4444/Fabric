from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput


class FinanceAgent(BaseAgent):
    """
    Finance tracking agent.
    Currently a well-structured stub — wire to a real finance API (Plaid, CSV import, etc.)
    """

    @property
    def name(self) -> str:
        return "finance_agent"

    @property
    def description(self) -> str:
        return "Tracks expenses, monitors budgets, generates financial summaries"

    @property
    def capabilities(self) -> list[str]:
        return ["expense_summary", "budget_alert", "spending_analysis"]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "expense_summary": self._expense_summary,
            "budget_alert": self._budget_alert,
            "spending_analysis": self._spending_analysis,
        }
        handler = dispatch.get(input.intent)
        if not handler:
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=False,
                error=f"Unknown intent: {input.intent}",
            )
        return await handler(input)

    async def _expense_summary(self, input: AgentInput) -> AgentOutput:
        # Stub — replace with real finance data source
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={
                "summary": "This month: $2,340 spent. Top categories: Software ($890), Travel ($650), Food ($420).",
                "total": 2340,
                "categories": {
                    "software": 890,
                    "travel": 650,
                    "food": 420,
                    "other": 380,
                },
            },
        )

    async def _budget_alert(self, input: AgentInput) -> AgentOutput:
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={
                "alerts": [
                    {"category": "Software", "spent": 890, "budget": 800, "over_by": 90},
                ],
            },
        )

    async def _spending_analysis(self, input: AgentInput) -> AgentOutput:
        claude = self.get_tool("claude")
        period = input.parameters.get("period", "this month")
        analysis = await claude.execute(
            prompt=f"Provide a brief financial spending analysis for {period}. "
                   "Assume typical business expenses and give 3 actionable insights.",
            system="You are a personal finance advisor. Be concise and actionable.",
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"analysis": analysis.data, "period": period},
        )
