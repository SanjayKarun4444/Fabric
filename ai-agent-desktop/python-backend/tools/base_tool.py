from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Any, Optional


class ToolResult(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult: ...
