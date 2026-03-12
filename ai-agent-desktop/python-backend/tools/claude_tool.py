import json
from tools.base_tool import BaseTool, ToolResult
from config import settings
from observability.logger import get_logger

_logger = get_logger("claude_tool")


class ClaudeTool(BaseTool):
    """Wraps the Anthropic Claude API for reasoning, summarization, and drafting."""

    def __init__(self):
        self._client = None
        self._available = bool(settings.anthropic_api_key)

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
