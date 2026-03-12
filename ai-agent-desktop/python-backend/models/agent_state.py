from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class AgentState(BaseModel):
    agent_id: str
    status: AgentStatus = AgentStatus.IDLE
    current_task_id: Optional[str] = None
    current_task_label: Optional[str] = None
    last_run: Optional[datetime] = None
    error: Optional[str] = None
    tasks_completed: int = 0
    tasks_failed: int = 0
    activity_log: list[dict] = Field(default_factory=list)  # [{ts, message, level}]

    def add_log(self, message: str, level: str = "info"):
        self.activity_log.append({
            "ts": datetime.utcnow().isoformat(),
            "message": message,
            "level": level,
        })
        # Keep last 50 entries
        if len(self.activity_log) > 50:
            self.activity_log = self.activity_log[-50:]

    @property
    def success_rate(self) -> float:
        total = self.tasks_completed + self.tasks_failed
        if total == 0:
            return 100.0
        return round((self.tasks_completed / total) * 100, 1)
