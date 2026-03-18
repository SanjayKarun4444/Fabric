#!/usr/bin/env python3
"""
MCP server — Google Calendar
Exposes: list_events, create_event, delete_event
Run standalone: python -m tools.mcp.calendar_server
"""

import asyncio
import json
import os
from datetime import datetime, timedelta

import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

server = Server("fabric-calendar")


def _build_service():
    cid = os.environ.get("GOOGLE_CLIENT_ID", "")
    csecret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    rtoken = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
    if not all([cid, csecret, rtoken]):
        return None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=rtoken,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=cid,
            client_secret=csecret,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception:
        return None


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_events",
            description="List Google Calendar events for a date range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Start date YYYY-MM-DD. Defaults to today.",
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days to include. Default 1.",
                        "default": 1,
                    },
                },
            },
        ),
        types.Tool(
            name="create_event",
            description="Create a new Google Calendar event.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Event title"},
                    "date": {"type": "string", "description": "Date YYYY-MM-DD"},
                    "end_date": {
                        "type": "string",
                        "description": "End date YYYY-MM-DD if different from start",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start time HH:MM (24h)",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End time HH:MM (24h)",
                    },
                    "description": {"type": "string", "description": "Event notes"},
                },
                "required": ["title", "date"],
            },
        ),
        types.Tool(
            name="delete_event",
            description="Delete a Google Calendar event by its event ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "string",
                        "description": "Google Calendar event ID",
                    }
                },
                "required": ["event_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(
    name: str, arguments: dict
) -> list[types.TextContent]:
    svc = _build_service()

    if name == "list_events":
        if svc is None:
            return [types.TextContent(type="text", text=json.dumps({"error": "Google Calendar not connected"}))]

        date_str = arguments.get("date") or datetime.now().date().isoformat()
        days_ahead = int(arguments.get("days_ahead", 1))
        target = datetime.fromisoformat(date_str).date()
        local_tz = datetime.now().astimezone().tzinfo
        day_start = datetime(target.year, target.month, target.day, tzinfo=local_tz)
        day_end = day_start + timedelta(days=days_ahead)

        result = svc.events().list(
            calendarId="primary",
            timeMin=day_start.isoformat(),
            timeMax=day_end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        ).execute()

        events = []
        for item in result.get("items", []):
            s = item.get("start", {})
            e = item.get("end", {})
            if "dateTime" in s:
                sdt = datetime.fromisoformat(s["dateTime"])
                edt = datetime.fromisoformat(e["dateTime"])
                time_str = sdt.strftime("%H:%M")
                dur = int((edt - sdt).total_seconds() / 60)
            else:
                time_str = "All day"
                dur = 0
            events.append({
                "id": item.get("id", ""),
                "title": item.get("summary", "(No title)"),
                "time": time_str,
                "duration_mins": dur,
                "location": item.get("location", ""),
                "description": item.get("description", ""),
            })
        return [types.TextContent(type="text", text=json.dumps(events))]

    elif name == "create_event":
        if svc is None:
            return [types.TextContent(type="text", text=json.dumps({"error": "Google Calendar not connected"}))]

        title = arguments["title"]
        date = arguments["date"]
        end_date = arguments.get("end_date") or date
        start_time = arguments.get("start_time")
        end_time = arguments.get("end_time")
        description = arguments.get("description", "")

        tz = datetime.now().astimezone().strftime("%z")
        tz = f"{tz[:3]}:{tz[3:]}"

        if start_time and end_time:
            body = {
                "summary": title,
                "description": description,
                "start": {"dateTime": f"{date}T{start_time}:00{tz}"},
                "end": {"dateTime": f"{end_date}T{end_time}:00{tz}"},
            }
        else:
            body = {
                "summary": title,
                "description": description,
                "start": {"date": date},
                "end": {"date": end_date},
            }

        created = svc.events().insert(calendarId="primary", body=body).execute()
        return [types.TextContent(type="text", text=json.dumps({
            "success": True,
            "event_id": created.get("id"),
            "htmlLink": created.get("htmlLink", ""),
            "title": title,
        }))]

    elif name == "delete_event":
        if svc is None:
            return [types.TextContent(type="text", text=json.dumps({"error": "Google Calendar not connected"}))]

        event_id = arguments["event_id"]
        svc.events().delete(calendarId="primary", eventId=event_id).execute()
        return [types.TextContent(type="text", text=json.dumps({
            "success": True,
            "deleted_event_id": event_id,
        }))]

    return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="fabric-calendar",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
