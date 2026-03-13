from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Optional
import uuid


class EventType(str, Enum):
    # Email
    EMAIL_RECEIVED = "email.received"
    EMAIL_DRAFTED = "email.drafted"
    INBOX_TRIAGED = "inbox.triaged"
    # Calendar
    MEETING_SCHEDULED = "meeting.scheduled"
    MEETING_REMINDER = "meeting.reminder"
    CALENDAR_EVENT_DELETED = "calendar.event_deleted"
    CONFLICT_DETECTED = "calendar.conflict_detected"
    # Tasks
    TASK_CREATED = "task.created"
    TASK_COMPLETED = "task.completed"
    TASK_OVERDUE = "task.overdue"
    # Research
    RESEARCH_REQUESTED = "research.requested"
    RESEARCH_COMPLETED = "research.completed"
    # System
    DAILY_SUMMARY_REQUESTED = "system.daily_summary"
    USER_COMMAND = "system.user_command"
    AGENT_STATE_CHANGED = "agent.state_changed"
    AGENT_FAILED = "agent.failed"
    WORKFLOW_COMPLETED = "workflow.completed"
    MORNING_ROUTINE = "system.morning_routine"
    EVENING_ROUTINE = "system.evening_routine"
    # Task completion — carries the agent's full result back to the UI
    TASK_RESULT = "task.result"


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: EventType
    payload: dict[str, Any] = {}
    source: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    workflow_id: Optional[str] = None

    def to_ws_message(self) -> dict:
        return {
            "type": "event",
            "event_type": self.type,
            "payload": self.payload,
            "source": self.source,
            "event_id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "workflow_id": self.workflow_id,
        }
