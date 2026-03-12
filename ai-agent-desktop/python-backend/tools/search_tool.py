from tools.base_tool import BaseTool, ToolResult
from observability.logger import get_logger

_logger = get_logger("search_tool")


class SearchTool(BaseTool):
    """Web search via DuckDuckGo Instant Answer API (no key required)."""

    @property
    def name(self) -> str:
        return "search"

    @property
    def description(self) -> str:
        return "Web search — returns relevant results for a query"

    async def execute(self, query: str, max_results: int = 5, **kwargs) -> ToolResult:
        try:
            import httpx
            url = "https://api.duckduckgo.com/"
            params = {"q": query, "format": "json", "no_redirect": 1, "no_html": 1}

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params)
                data = resp.json()

            results = []

            # Abstract / instant answer
            if data.get("Abstract"):
                results.append({
                    "title": data.get("Heading", query),
                    "snippet": data["Abstract"],
                    "url": data.get("AbstractURL", ""),
                    "source": data.get("AbstractSource", ""),
                })

            # Related topics
            for topic in data.get("RelatedTopics", [])[:max_results]:
                if isinstance(topic, dict) and topic.get("Text"):
                    results.append({
                        "title": topic.get("Text", "")[:80],
                        "snippet": topic.get("Text", ""),
                        "url": topic.get("FirstURL", ""),
                        "source": "DuckDuckGo",
                    })

            if not results:
                results = [{"title": f"Search: {query}", "snippet": "No instant results. Try a more specific query.", "url": "", "source": ""}]

            return ToolResult(success=True, data={"query": query, "results": results[:max_results]})

        except ImportError:
            _logger.warning("httpx not installed — returning stub search results")
            return ToolResult(success=True, data={
                "query": query,
                "results": [{"title": f"Result for: {query}", "snippet": "Install httpx for real search results.", "url": "", "source": "stub"}],
            })
        except Exception as e:
            _logger.error(f"Search error: {e}")
            return ToolResult(success=False, error=str(e))
