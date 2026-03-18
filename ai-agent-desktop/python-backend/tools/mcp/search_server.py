#!/usr/bin/env python3
"""
MCP server — Web Search (DuckDuckGo, no API key required)
Exposes: web_search
Run standalone: python -m tools.mcp.search_server
"""

import asyncio
import json

import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

server = Server("fabric-search")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="web_search",
            description="Search the web using DuckDuckGo and return relevant results.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results. Default 5.",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name != "web_search":
        return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]

    query = arguments["query"]
    max_results = int(arguments.get("max_results", 5))

    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_redirect": 1, "no_html": 1},
            )
            data = resp.json()

        results = []
        if data.get("Abstract"):
            results.append({
                "title": data.get("Heading", query),
                "snippet": data["Abstract"],
                "url": data.get("AbstractURL", ""),
                "source": data.get("AbstractSource", ""),
            })
        for topic in data.get("RelatedTopics", [])[:max_results]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({
                    "title": topic.get("Text", "")[:80],
                    "snippet": topic.get("Text", ""),
                    "url": topic.get("FirstURL", ""),
                    "source": "DuckDuckGo",
                })
        if not results:
            results = [{"title": f"Search: {query}", "snippet": "No instant results found.", "url": "", "source": ""}]

        return [types.TextContent(type="text", text=json.dumps({
            "query": query,
            "results": results[:max_results],
        }))]

    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="fabric-search",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
