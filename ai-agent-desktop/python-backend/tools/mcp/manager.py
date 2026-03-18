"""
MCPManager — lifecycle manager for all Fabric MCP servers.

Each server connection runs entirely inside a dedicated asyncio Task so that
anyio cancel scopes are never entered/exited across task boundaries (which
would raise "Attempted to exit cancel scope in a different task").

Usage:
    manager = MCPManager(backend_dir)
    await manager.start()          # call once at app startup
    tools = manager.get_anthropic_tools()
    result = await manager.call_tool("list_events", {"date": "2026-03-20"})
    await manager.stop()           # call at app shutdown
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from observability.logger import get_logger

_logger = get_logger("mcp_manager")


class _ServerConn:
    """
    One MCP server connection.

    The stdio_client and ClientSession context managers live entirely inside
    _run(), which is an asyncio Task — satisfying anyio's requirement that
    cancel scopes are entered and exited in the same task.
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self.tools: list = []
        self._session: ClientSession | None = None
        self._ready = asyncio.Event()
        self._shutdown = asyncio.Event()
        self._task: asyncio.Task | None = None
        self._start_error: Exception | None = None

    async def start(self, params: StdioServerParameters) -> None:
        """Spawn the background task and wait until the server is initialised."""
        self._task = asyncio.create_task(self._run(params), name=f"mcp-{self.name}")
        try:
            # Wait up to 30 s for _run() to finish initialisation and set _ready.
            await asyncio.wait_for(self._ready.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            self._task.cancel()
            raise RuntimeError(f"MCP server '{self.name}' did not initialise within 30 s")
        if self._start_error:
            raise self._start_error

    async def _run(self, params: StdioServerParameters) -> None:
        """
        Own the entire lifecycle of the stdio connection.
        Runs until self._shutdown is set.
        """
        try:
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    self.tools = result.tools
                    self._session = session
                    self._ready.set()
                    _logger.info(
                        f"MCP '{self.name}' ready — "
                        f"{len(self.tools)} tool(s): {[t.name for t in self.tools]}"
                    )
                    await self._shutdown.wait()
        except Exception as exc:
            _logger.error(f"MCP server '{self.name}' error: {exc}")
            if not self._ready.is_set():
                self._start_error = exc
                self._ready.set()   # unblock start() so it can re-raise
            raise

    async def stop(self) -> None:
        self._shutdown.set()
        if self._task and not self._task.done():
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
                self._task.cancel()

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        if self._session is None:
            return json.dumps({"error": f"Server '{self.name}' not connected"})
        try:
            result = await self._session.call_tool(tool_name, arguments)
            parts = [c.text for c in result.content if hasattr(c, "text")]
            return "\n".join(parts)
        except Exception as exc:
            return json.dumps({"error": str(exc)})


class MCPManager:
    """Manages all Fabric MCP server connections."""

    def __init__(self, backend_dir: str) -> None:
        self._backend_dir = backend_dir
        self._servers: dict[str, _ServerConn] = {}

    async def start(self) -> None:
        """Spawn and connect all four MCP servers. Called once at startup."""
        import os
        server_modules = {
            "calendar": "tools.mcp.calendar_server",
            "gmail":    "tools.mcp.gmail_server",
            "search":   "tools.mcp.search_server",
            "tasks":    "tools.mcp.task_server",
        }
        # Explicitly snapshot the current env so subprocesses receive all vars
        # that load_dotenv() placed into os.environ (e.g. Google credentials).
        current_env = {k: v for k, v in os.environ.items()}
        for name, module in server_modules.items():
            conn = _ServerConn(name=name)
            params = StdioServerParameters(
                command=sys.executable,   # venv Python that's running this app
                args=["-m", module],
                env=current_env,
                cwd=self._backend_dir,
            )
            try:
                await conn.start(params)
                self._servers[name] = conn
            except Exception as exc:
                _logger.error(f"Failed to start MCP server '{name}': {exc}")

    async def stop(self) -> None:
        """Stop all MCP server connections. Called at shutdown."""
        for conn in self._servers.values():
            await conn.stop()
        self._servers.clear()
        _logger.info("All MCP servers stopped.")

    def get_anthropic_tools(self) -> list[dict]:
        """
        Return all tools from all connected servers in Anthropic tool format:
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
        return json.dumps({"error": f"No MCP server found for tool: {tool_name}"})

    @property
    def connected_servers(self) -> list[str]:
        return list(self._servers.keys())
