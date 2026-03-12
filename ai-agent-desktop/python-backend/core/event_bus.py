import asyncio
from collections import defaultdict
from typing import Callable, Awaitable
from models.events import Event, EventType
from observability.logger import get_logger

Handler = Callable[[Event], Awaitable[None]]
_logger = get_logger("event_bus")


class EventBus:
    """
    Async in-process event bus backed by asyncio.Queue.
    To go distributed: swap _queue for redis.asyncio Streams.
    Handlers run concurrently per event; individual failures are isolated.
    """

    def __init__(self):
        self._handlers: dict[str, list[Handler]] = defaultdict(list)
        self._queue: asyncio.Queue[Event] = asyncio.Queue()
        self._running = False
        self._task: asyncio.Task | None = None

    def subscribe(self, event_type: EventType, handler: Handler) -> None:
        self._handlers[event_type].append(handler)
        _logger.info(f"Subscribed {handler.__qualname__} → {event_type}")

    async def publish(self, event: Event) -> None:
        _logger.info(
            f"Event published",
            extra={"event_type": event.type, "event_id": event.id, "source": event.source},
        )
        await self._queue.put(event)

    async def start(self) -> None:
        self._running = True
        self._task = asyncio.create_task(self._dispatch_loop(), name="event_bus")
        _logger.info("EventBus started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _dispatch_loop(self) -> None:
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                handlers = self._handlers.get(event.type, [])
                if not handlers:
                    _logger.warning(f"No handlers registered for {event.type}")
                else:
                    results = await asyncio.gather(
                        *[h(event) for h in handlers],
                        return_exceptions=True,
                    )
                    for r in results:
                        if isinstance(r, Exception):
                            _logger.error(f"Handler error in event {event.type}: {r}")
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                _logger.error(f"EventBus dispatch loop error: {e}", exc_info=True)
