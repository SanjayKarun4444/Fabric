import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from enum import IntEnum
import uuid


class TaskPriority(IntEnum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass(order=True)
class QueuedTask:
    priority: TaskPriority
    # Fields below are not used for ordering
    created_at: datetime = field(compare=False, default_factory=datetime.utcnow)
    task_id: str = field(compare=False, default_factory=lambda: str(uuid.uuid4()))
    agent_name: str = field(compare=False, default="")
    input: Any = field(compare=False, default=None)
    retries: int = field(compare=False, default=0)
    max_retries: int = field(compare=False, default=3)


class TaskQueue:
    def __init__(self):
        self._queue: asyncio.PriorityQueue[QueuedTask] = asyncio.PriorityQueue()

    async def enqueue(self, task: QueuedTask) -> None:
        await self._queue.put(task)

    async def dequeue(self) -> QueuedTask:
        return await self._queue.get()

    def task_done(self) -> None:
        self._queue.task_done()

    def size(self) -> int:
        return self._queue.qsize()
