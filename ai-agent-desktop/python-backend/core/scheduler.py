import asyncio
from datetime import datetime, time
from typing import Callable, Awaitable
from observability.logger import get_logger

_logger = get_logger("scheduler")

Job = Callable[[], Awaitable[None]]


class ScheduledJob:
    def __init__(self, name: str, fn: Job, hour: int, minute: int = 0, enabled: bool = True):
        self.name = name
        self.fn = fn
        self.hour = hour
        self.minute = minute
        self.enabled = enabled
        self.last_run: datetime | None = None


class Scheduler:
    """
    Simple cron-like scheduler backed by asyncio.
    Checks every minute whether any jobs are due.
    """

    def __init__(self):
        self._jobs: list[ScheduledJob] = []
        self._task: asyncio.Task | None = None
        self._running = False

    def add_job(self, name: str, fn: Job, hour: int, minute: int = 0) -> None:
        self._jobs.append(ScheduledJob(name, fn, hour, minute))
        _logger.info(f"Scheduled job: {name} at {hour:02d}:{minute:02d}")

    async def start(self) -> None:
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="scheduler")
        _logger.info("Scheduler started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while self._running:
            now = datetime.now()
            for job in self._jobs:
                if not job.enabled:
                    continue
                if now.hour == job.hour and now.minute == job.minute:
                    # Only fire once per minute-window
                    if job.last_run is None or (now - job.last_run).total_seconds() > 60:
                        job.last_run = now
                        _logger.info(f"Running scheduled job: {job.name}")
                        asyncio.create_task(self._run_job(job))
            # Sleep until the next minute
            await asyncio.sleep(60 - now.second)

    async def _run_job(self, job: ScheduledJob) -> None:
        try:
            await job.fn()
        except Exception as e:
            _logger.error(f"Scheduled job {job.name} failed: {e}", exc_info=True)
