from pydantic import BaseModel, Field
from typing import Any, Optional
import uuid


class AgentInput(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: Optional[str] = None
    intent: str
    parameters: dict[str, Any] = {}
    context: dict[str, Any] = {}
    user_id: str = "default"


class AgentAction(BaseModel):
    type: str  # "tool_call" | "delegate" | "respond"
    tool: Optional[str] = None
    parameters: dict[str, Any] = {}
    result: Optional[Any] = None
    success: bool = True


class AgentOutput(BaseModel):
    task_id: str
    agent: str
    success: bool
    actions_taken: list[AgentAction] = []
    result: Optional[Any] = None
    events_emitted: list[str] = []
    error: Optional[str] = None
    metadata: dict[str, Any] = {}
