from abc import ABC, abstractmethod
from datetime import datetime
from models.agent_state import AgentState, AgentStatus
from models.messages import AgentInput, AgentOutput
from tools.registry import ToolRegistry
from memory.manager import MemoryManager
from models.events import Event, EventType
from observability.logger import get_logger


class BaseAgent(ABC):
    """
    All agents extend this. Agents are stateless processors:
    - receive AgentInput
    - use tools via ToolRegistry
    - return AgentOutput
    - publish events via EventBus
    - never call other agents directly
    """

    def __init__(self, tool_registry: ToolRegistry, memory: MemoryManager, event_bus):
        self.tools = tool_registry
        self.memory = memory
        self._event_bus = event_bus
        self._state = AgentState(agent_id=self.name)
        self.logger = get_logger(self.name)

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @property
    @abstractmethod
    def capabilities(self) -> list[str]: ...

    @abstractmethod
    async def execute(self, input: AgentInput) -> AgentOutput: ...

    async def run(self, input: AgentInput) -> AgentOutput:
        """Lifecycle wrapper. Handles state transitions and error isolation."""
        if self._state.status == AgentStatus.PAUSED:
            return AgentOutput(
                task_id=input.task_id,
                agent=self.name,
                success=False,
                error="Agent is paused",
            )

        await self._set_status(AgentStatus.RUNNING, task_id=input.task_id, label=input.intent)
        start = datetime.utcnow()
        try:
            output = await self.execute(input)
            elapsed_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
            if output.success:
                self._state.tasks_completed += 1
                self._state.add_log(f"✓ {input.intent} ({elapsed_ms}ms)")
            else:
                self._state.tasks_failed += 1
                self._state.add_log(f"✗ {input.intent}: {output.error}", level="error")
            await self._set_status(AgentStatus.COMPLETED)
            return output
        except Exception as e:
            self._state.tasks_failed += 1
            self._state.add_log(f"✗ {input.intent}: {e}", level="error")
            await self._set_status(AgentStatus.FAILED, error=str(e))
            self.logger.error(f"Agent error", extra={"intent": input.intent, "error": str(e)}, exc_info=True)
            raise

    async def _set_status(
        self,
        status: AgentStatus,
        task_id: str = None,
        label: str = None,
        error: str = None,
    ) -> None:
        self._state.status = status
        self._state.last_run = datetime.utcnow()
        if task_id:
            self._state.current_task_id = task_id
        if label:
            self._state.current_task_label = label
        if error:
            self._state.error = error
        if status in (AgentStatus.COMPLETED, AgentStatus.FAILED, AgentStatus.IDLE):
            self._state.current_task_label = None

        await self._event_bus.publish(Event(
            type=EventType.AGENT_STATE_CHANGED,
            payload=self._state.model_dump(mode="json"),
            source=self.name,
        ))

    def get_tool(self, name: str):
        return self.tools.get(name)

    @property
    def state(self) -> AgentState:
        return self._state
