import json
from typing import TYPE_CHECKING

from tools.base_tool import BaseTool, ToolResult
from config import settings
from observability.logger import get_logger

if TYPE_CHECKING:
    from tools.mcp.manager import MCPManager

_logger = get_logger("claude_tool")


class ClaudeTool(BaseTool):
    """Wraps the Anthropic Claude API for reasoning, summarization, and drafting."""

    def __init__(self):
        self._client = None
        self._available = bool(settings.anthropic_api_key)
        self.mcp: "MCPManager | None" = None  # injected by desktop_server after startup

    def _get_client(self):
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            except ImportError:
                _logger.warning("anthropic package not installed")
        return self._client

    @property
    def name(self) -> str:
        return "claude"

    @property
    def description(self) -> str:
        return "Anthropic Claude API — reasoning, summarization, drafting, classification"

    async def execute(
        self,
        prompt: str,
        system: str = "You are a helpful AI assistant.",
        max_tokens: int = 4096,
        as_json: bool = False,
        **kwargs,
    ) -> ToolResult:
        if not self._available:
            # Graceful stub when no API key configured
            _logger.warning("Claude API key not configured — returning stub response")
            stub = f"[Claude stub] Processed: {prompt[:80]}..."
            return ToolResult(success=True, data=stub)

        client = self._get_client()
        if client is None:
            return ToolResult(success=False, error="anthropic package not installed")

        try:
            response = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text

            if as_json:
                # Strip markdown code fences if present
                clean = text.strip()
                if clean.startswith("```"):
                    clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                try:
                    return ToolResult(success=True, data=json.loads(clean))
                except json.JSONDecodeError:
                    return ToolResult(success=True, data=text)

            return ToolResult(success=True, data=text)
        except Exception as e:
            _logger.error(f"Claude API error: {e}")
            return ToolResult(success=False, error=str(e))

    async def execute_with_tools(
        self,
        prompt: str,
        system: str = "You are a helpful AI assistant.",
        max_tokens: int = 4096,
        mcp_manager: "MCPManager | None" = None,
        **kwargs,
    ) -> ToolResult:
        """
        Call Claude with MCP tool access.

        Claude decides which tools to call, the manager routes each call to the
        correct MCP server, and results are fed back until Claude returns a final
        text response.  Falls back to plain execute() if no MCP manager is set.
        """
        manager = mcp_manager or self.mcp
        if manager is None:
            return await self.execute(prompt=prompt, system=system, max_tokens=max_tokens)

        if not self._available:
            return ToolResult(success=True, data=f"[Claude stub] {prompt[:80]}...")

        client = self._get_client()
        if client is None:
            return ToolResult(success=False, error="anthropic package not installed")

        tools = manager.get_anthropic_tools()
        messages = [{"role": "user", "content": prompt}]

        try:
            for _ in range(10):  # safety cap on tool-call rounds
                response = await client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=max_tokens,
                    system=system,
                    tools=tools,
                    messages=messages,
                )

                if response.stop_reason == "end_turn":
                    text = next(
                        (b.text for b in response.content if hasattr(b, "text")), ""
                    )
                    return ToolResult(success=True, data=text)

                if response.stop_reason == "tool_use":
                    # Add Claude's response to the conversation
                    messages.append({"role": "assistant", "content": response.content})

                    # Execute each tool call via MCP and collect results
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            _logger.info(f"MCP tool call: {block.name}({block.input})")
                            result_text = await manager.call_tool(block.name, block.input)
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_text,
                            })

                    messages.append({"role": "user", "content": tool_results})
                    continue

                # Any other stop reason — return what we have
                text = next(
                    (b.text for b in response.content if hasattr(b, "text")), ""
                )
                return ToolResult(success=True, data=text)

            return ToolResult(success=False, error="Tool-use loop exceeded max rounds")

        except Exception as e:
            _logger.error(f"Claude execute_with_tools error: {e}")
            return ToolResult(success=False, error=str(e))
