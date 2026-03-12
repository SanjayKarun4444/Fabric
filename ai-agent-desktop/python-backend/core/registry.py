from typing import Optional, TYPE_CHECKING
from observability.logger import get_logger

if TYPE_CHECKING:
    from agents.base_agent import BaseAgent

_logger = get_logger("agent_registry")


class AgentRegistry:
    def __init__(self):
        self._agents: dict[str, "BaseAgent"] = {}

    def register(self, agent: "BaseAgent") -> None:
        self._agents[agent.name] = agent
        _logger.info(f"Agent registered: {agent.name}")

    def get(self, name: str) -> Optional["BaseAgent"]:
        return self._agents.get(name)

    def all(self) -> list["BaseAgent"]:
        return list(self._agents.values())

    def find_by_capability(self, capability: str) -> list["BaseAgent"]:
        return [a for a in self._agents.values() if capability in a.capabilities]

    def get_summary(self) -> list[dict]:
        return [
            {
                # agent_id is the canonical key used by the frontend
                "agent_id": a.name,
                "name": a.name,
                "description": a.description,
                "capabilities": a.capabilities,
                "status": a.state.status,
                "tasks_completed": a.state.tasks_completed,
                "tasks_failed": a.state.tasks_failed,
                "success_rate": a.state.success_rate,
                "last_run": a.state.last_run.isoformat() if a.state.last_run else None,
                "current_task_label": a.state.current_task_label,
                "activity_log": a.state.activity_log[-20:],
                "error": a.state.error,
            }
            for a in self._agents.values()
        ]

    def pause_agent(self, name: str) -> bool:
        from models.agent_state import AgentStatus
        agent = self._agents.get(name)
        if agent:
            agent._state.status = AgentStatus.PAUSED
            return True
        return False

    def resume_agent(self, name: str) -> bool:
        from models.agent_state import AgentStatus
        agent = self._agents.get(name)
        if agent and agent._state.status == AgentStatus.PAUSED:
            agent._state.status = AgentStatus.IDLE
            return True
        return False
