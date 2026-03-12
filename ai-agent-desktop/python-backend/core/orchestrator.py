import asyncio
import uuid
from typing import Optional

from core.registry import AgentRegistry
from core.event_bus import EventBus
from core.task_queue import TaskQueue, QueuedTask, TaskPriority
from memory.manager import MemoryManager
from models.messages import AgentInput, AgentOutput
from models.events import Event, EventType
from observability.logger import get_logger

_logger = get_logger("orchestrator")

# ── Predefined multi-agent workflows ──────────────────────────────────────────

PREPARE_FOR_TOMORROW = [
    {"agent": "calendar_agent", "intent": "get_tomorrow_meetings"},
    {"agent": "research_agent", "intent": "research_participants"},
    {"agent": "email_agent", "intent": "find_related_threads"},
    {"agent": "task_agent", "intent": "surface_relevant_tasks", "optional": True},
    {"agent": "assistant_agent", "intent": "compile_briefing"},
]

HANDLE_INBOX = [
    {"agent": "email_agent", "intent": "triage_inbox"},
    {"agent": "task_agent", "intent": "create_followup_tasks", "optional": True},
]

DAILY_SUMMARY = [
    {"agent": "email_agent", "intent": "inbox_summary"},
    {"agent": "calendar_agent", "intent": "get_today_meetings"},
    {"agent": "task_agent", "intent": "surface_overdue_tasks", "optional": True},
    {"agent": "assistant_agent", "intent": "compile_daily_summary"},
]

MORNING_ROUTINE = [
    {"agent": "calendar_agent", "intent": "get_today_meetings"},
    {"agent": "email_agent", "intent": "inbox_summary"},
    {"agent": "task_agent", "intent": "surface_high_priority_tasks", "optional": True},
    {"agent": "assistant_agent", "intent": "compile_morning_briefing"},
]


class AgentOrchestrator:
    """
    Central coordinator. Agents never call each other directly — all
    routing flows through here. Subscribes to system events and dispatches
    tasks to the appropriate agent via the TaskQueue.
    """

    def __init__(
        self,
        registry: AgentRegistry,
        event_bus: EventBus,
        task_queue: TaskQueue,
        memory: MemoryManager,
    ):
        self.registry = registry
        self.event_bus = event_bus
        self.task_queue = task_queue
        self.memory = memory
        self._worker_tasks: list[asyncio.Task] = []

        # Subscribe to system-level events
        event_bus.subscribe(EventType.USER_COMMAND, self._handle_user_command)
        event_bus.subscribe(EventType.INBOX_TRIAGED, self._handle_inbox_triaged)
        event_bus.subscribe(EventType.AGENT_FAILED, self._handle_agent_failure)
        event_bus.subscribe(EventType.DAILY_SUMMARY_REQUESTED, self._handle_daily_summary)
        event_bus.subscribe(EventType.MORNING_ROUTINE, self._handle_morning_routine)
        event_bus.subscribe(EventType.EVENING_ROUTINE, self._handle_evening_routine)

    async def start(self, workers: int = 4) -> None:
        for i in range(workers):
            t = asyncio.create_task(self._worker_loop(), name=f"orchestrator_worker_{i}")
            self._worker_tasks.append(t)
        _logger.info(f"Orchestrator started ({workers} workers)")

    async def stop(self) -> None:
        for t in self._worker_tasks:
            t.cancel()
        await asyncio.gather(*self._worker_tasks, return_exceptions=True)

    # ── Public API ─────────────────────────────────────────────────────────────

    async def dispatch(
        self,
        intent: str,
        parameters: dict = {},
        agent_name: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        workflow_id: Optional[str] = None,
    ) -> str:
        """Enqueue a task. Returns task_id for tracking."""
        target = agent_name or self._route(intent)
        task_id = str(uuid.uuid4())
        workflow_id = workflow_id or str(uuid.uuid4())
        context = await self.memory.get_context(workflow_id)

        task = QueuedTask(
            priority=priority,
            task_id=task_id,
            agent_name=target,
            input=AgentInput(
                task_id=task_id,
                workflow_id=workflow_id,
                intent=intent,
                parameters=parameters,
                context=context,
            ),
        )
        await self.task_queue.enqueue(task)
        _logger.info(
            "Task dispatched",
            extra={"task_id": task_id, "agent": target, "intent": intent},
        )
        return task_id

    async def run_workflow(self, steps: list[dict], workflow_id: str = None) -> list[AgentOutput]:
        """
        Execute a sequence of agent steps.
        Each step receives the accumulated results of all prior steps in its context.
        Non-optional step failure aborts the workflow.
        """
        workflow_id = workflow_id or str(uuid.uuid4())
        results: list[AgentOutput] = []
        accumulated: dict = {}

        _logger.info(f"Workflow starting", extra={"workflow_id": workflow_id, "steps": len(steps)})

        for step in steps:
            agent = self.registry.get(step["agent"])
            if not agent:
                _logger.error(f"Unknown agent in workflow: {step['agent']}")
                if not step.get("optional"):
                    break
                continue

            from models.agent_state import AgentStatus
            if agent.state.status == AgentStatus.PAUSED:
                _logger.warning(f"Agent {step['agent']} is paused — skipping step")
                continue

            agent_input = AgentInput(
                workflow_id=workflow_id,
                intent=step["intent"],
                parameters=step.get("parameters", {}),
                context={**accumulated, **step.get("extra_context", {})},
            )

            try:
                result = await agent.run(agent_input)
            except Exception as e:
                _logger.error(f"Workflow step failed: {step['intent']} — {e}")
                result = AgentOutput(
                    task_id=agent_input.task_id,
                    agent=step["agent"],
                    success=False,
                    error=str(e),
                )

            results.append(result)

            if result.success and result.result is not None:
                accumulated[step["agent"]] = result.result

            if not result.success and not step.get("optional"):
                _logger.error(f"Workflow {workflow_id} aborted at step: {step['intent']}")
                break

        await self.event_bus.publish(Event(
            type=EventType.WORKFLOW_COMPLETED,
            payload={"workflow_id": workflow_id, "steps_completed": len(results)},
            source="orchestrator",
            workflow_id=workflow_id,
        ))
        return results

    async def run_named_workflow(self, name: str) -> list[AgentOutput]:
        workflows = {
            "prepare_for_tomorrow": PREPARE_FOR_TOMORROW,
            "handle_inbox": HANDLE_INBOX,
            "daily_summary": DAILY_SUMMARY,
            "morning_routine": MORNING_ROUTINE,
        }
        steps = workflows.get(name)
        if not steps:
            raise ValueError(f"Unknown workflow: {name}")
        return await self.run_workflow(steps)

    # ── Worker loop ────────────────────────────────────────────────────────────

    async def _worker_loop(self) -> None:
        while True:
            try:
                task = await self.task_queue.dequeue()
                agent = self.registry.get(task.agent_name)
                if not agent:
                    _logger.error(f"Agent not registered: {task.agent_name}")
                    self.task_queue.task_done()
                    continue
                # Run without blocking the worker loop
                asyncio.create_task(self._execute_task(agent, task))
            except asyncio.CancelledError:
                break
            except Exception as e:
                _logger.error(f"Worker loop error: {e}", exc_info=True)

    async def _execute_task(self, agent, task: QueuedTask) -> None:
        try:
            await agent.run(task.input)
        except Exception as e:
            if task.retries < task.max_retries:
                task.retries += 1
                delay = 2 ** task.retries
                _logger.warning(
                    f"Retrying task",
                    extra={"task_id": task.task_id, "attempt": task.retries, "delay": delay},
                )
                await asyncio.sleep(delay)
                await self.task_queue.enqueue(task)
            else:
                await self.event_bus.publish(Event(
                    type=EventType.AGENT_FAILED,
                    payload={"task_id": task.task_id, "agent": task.agent_name, "error": str(e)},
                    source="orchestrator",
                ))
        finally:
            self.task_queue.task_done()

    # ── Routing ────────────────────────────────────────────────────────────────

    def _route(self, intent: str) -> str:
        """
        Keyword-based intent routing.
        Upgrade to LLM-based routing by passing registry.get_summary()
        to ClaudeTool and asking it to pick the right agent.
        """
        rules = [
            (["email", "inbox", "draft", "reply", "thread", "gmail", "newsletter"], "email_agent"),
            (["meeting", "calendar", "schedule", "event", "tomorrow", "today's meetings", "conflict"], "calendar_agent"),
            (["task", "todo", "deadline", "priority", "overdue", "followup", "follow-up"], "task_agent"),
            (["research", "search", "find", "look up", "summarize", "web"], "research_agent"),
            (["finance", "expense", "budget", "spend", "cost", "invoice"], "finance_agent"),
        ]
        lower = intent.lower()
        for keywords, agent_name in rules:
            if any(k in lower for k in keywords):
                if self.registry.get(agent_name):
                    return agent_name
        return "assistant_agent"

    # ── Event handlers ─────────────────────────────────────────────────────────

    async def _handle_user_command(self, event: Event) -> None:
        command = event.payload.get("command", "")
        parameters = event.payload.get("parameters", {})

        # Check for named workflows first
        workflow_map = {
            "prepare_for_tomorrow": "prepare_for_tomorrow",
            "handle_inbox": "handle_inbox",
            "morning_routine": "morning_routine",
            "daily_summary": "daily_summary",
            "evening_routine": "daily_summary",
        }
        if command in workflow_map:
            asyncio.create_task(self.run_named_workflow(workflow_map[command]))
        else:
            await self.dispatch(intent=command, parameters=parameters, priority=TaskPriority.HIGH)

    async def _handle_inbox_triaged(self, event: Event) -> None:
        """After triage, auto-create follow-up tasks for urgent emails."""
        triaged = event.payload.get("triaged", [])
        if isinstance(triaged, list):
            urgent = [e for e in triaged if isinstance(e, dict) and e.get("urgency") == "urgent"]
            if urgent:
                await self.dispatch(
                    intent="create_followup_tasks",
                    parameters={"emails": urgent},
                    agent_name="task_agent",
                    workflow_id=event.workflow_id,
                )

    async def _handle_agent_failure(self, event: Event) -> None:
        _logger.error("Agent failure recorded", extra=event.payload)

    async def _handle_daily_summary(self, event: Event) -> None:
        asyncio.create_task(self.run_named_workflow("daily_summary"))

    async def _handle_morning_routine(self, event: Event) -> None:
        asyncio.create_task(self.run_named_workflow("morning_routine"))

    async def _handle_evening_routine(self, event: Event) -> None:
        asyncio.create_task(self.run_named_workflow("daily_summary"))
