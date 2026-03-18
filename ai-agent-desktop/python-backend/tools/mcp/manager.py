"""
MCPManager — lifecycle manager for all Fabric MCP servers.

Start once at application startup (lifespan), stop at shutdown.
Provides:
  - get_anthropic_tools()  → Anthropic-format tool definitions for all connected servers
  - call_tool(name, args)  → routes a tool call to the correct server, returns text result
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from observability.logger import get_logger

_logger = get_logger("mcp_manager")


@dataclass
class _ServerConn:
    """Holds the live state of one MCP server connection."""

    name: str
    tools: list = field(default_factory=list)
    _session: ClientSession | None = None
    _stdio_cm: Any = None
    _session_cm: Any = None

    async def start(self, params: StdioServerParameters) -> None:
        self._stdio_cm = stdio_client(params)
        read, write = await self._stdio_cm.__aenter__()
        self._session_cm = ClientSession(read, write)
        self._session = await self._session_cm.__aenter__()
        await self._session.initialize()
        result = await self._session.list_tools()
        self.tools = result.tools
        _logger.info(f"MCP server '{self.name}' connected — {len(self.tools)} tool(s): {[t.name for t in self.tools]}")

    async def stop(self) -> None:
        try:
            if self._session_cm:
                await self._session_cm.__aexit__(None, None, None)
            if self._stdio_cm:
                await self._stdio_cm.__aexit__(None, None, None)
        except Exception as e:
            _logger.warning(f"Error stopping MCP server '{self.name}': {e}")

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        if self._session is None:
            return f'{{"error": "Server {self.name} not connected"}}'
        result = await self._session.call_tool(tool_name, arguments)
        # MCP returns a list of content blocks; join text blocks
        parts = [c.text for c in result.content if hasattr(c, "text")]
        return "\n".join(parts)


class MCPManager:
    """Manages all Fabric MCP server connections."""

    def __init__(self, backend_dir: str, env: dict | None = None):
        self._backend_dir = backend_dir
        self._env = {**os.environ, **(env or {})}
        self._servers: dict[str, _ServerConn] = {}

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Spawn and connect all four MCP servers. Called once at startup."""
        server_modules = {
            "calendar": "tools.mcp.calendar_server",
            "gmail": "tools.mcp.gmail_server",
            "search": "tools.mcp.search_server",
            "tasks": "tools.mcp.task_server",
        }
        for name, module in server_modules.items():
            conn = _ServerConn(name=name)
            params = StdioServerParameters(
                command=sys.executable,
                args=["-m", module],
                env=self._env,
                cwd=self._backend_dir,
            )
            try:
                await conn.start(params)
                self._servers[name] = conn
            except Exception as e:
                _logger.error(f"Failed to start MCP server '{name}': {e}")

    async def stop(self) -> None:
        """Stop all MCP server connections. Called at shutdown."""
        for conn in self._servers.values():
            await conn.stop()
        self._servers.clear()
        _logger.info("All MCP servers stopped.")

    # ── Tool access ───────────────────────────────────────────────────────────

    def get_anthropic_tools(self) -> list[dict]:
        """
        Return all tools from all connected servers in Anthropic tool_use format:
        [{"name": ..., "description": ..., "input_schema": {...}}, ...]
        """
        tools = []
        for conn in self._servers.values():
            for t in conn.tools:
                tools.append({
                    "name": t.name,
                    "description": t.description or "",
                    "input_schema": t.inputSchema,
                })
        return tools

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """Route a tool call to the server that owns it."""
        for conn in self._servers.values():
            if any(t.name == tool_name for t in conn.tools):
                return await conn.call_tool(tool_name, arguments)
        return f'{{"error": "No MCP server found for tool: {tool_name}"}}'

    @property
    def connected_servers(self) -> list[str]:
        return list(self._servers.keys())
