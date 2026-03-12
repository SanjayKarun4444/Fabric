from tools.base_tool import BaseTool
from typing import Optional
from observability.logger import get_logger

_logger = get_logger("tool_registry")


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool
        _logger.info(f"Tool registered: {tool.name}")

    def get(self, name: str) -> BaseTool:
        tool = self._tools.get(name)
        if tool is None:
            raise KeyError(f"Tool not registered: '{name}'. Available: {list(self._tools.keys())}")
        return tool

    def has(self, name: str) -> bool:
        return name in self._tools

    def list_tools(self) -> list[dict]:
        return [{"name": t.name, "description": t.description} for t in self._tools.values()]
