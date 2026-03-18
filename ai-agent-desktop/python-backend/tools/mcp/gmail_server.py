#!/usr/bin/env python3
"""
MCP server — Gmail
Exposes: fetch_inbox, get_email, search_emails, get_counts, create_draft, list_drafts, send_draft, delete_draft
Run standalone: python -m tools.mcp.gmail_server
"""

import asyncio
import base64
import json
import os
from datetime import datetime
from email.mime.text import MIMEText

import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

server = Server("fabric-gmail")


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
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.compose",
            ],
        )
        return build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception:
        return None


def _humanize(date_str: str) -> str:
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(date_str)
        delta = datetime.now(dt.tzinfo) - dt
        hours = int(delta.total_seconds() // 3600)
        if hours < 1:
            return "Just now"
        if hours < 24:
            return f"{hours}h ago"
        return f"{delta.days}d ago"
    except Exception:
        return date_str


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="fetch_inbox",
            description="Fetch recent emails from Gmail inbox.",
            inputSchema={
                "type": "object",
                "properties": {
                    "max_results": {
                        "type": "integer",
                        "description": "Max emails to return. Default 20.",
                        "default": 20,
                    }
                },
            },
        ),
        types.Tool(
            name="get_email",
            description="Get the full content of an email by its ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "email_id": {"type": "string", "description": "Gmail message ID"}
                },
                "required": ["email_id"],
            },
        ),
        types.Tool(
            name="search_emails",
            description="Search Gmail using a query string (same syntax as Gmail search box).",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query"},
                    "max_results": {
                        "type": "integer",
                        "description": "Max results. Default 10.",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="get_counts",
            description="Get unread and urgent email counts.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="create_draft",
            description="Create a Gmail draft.",
            inputSchema={
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "Recipient email address",
                    },
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body text"},
                },
                "required": ["to", "subject", "body"],
            },
        ),
        types.Tool(
            name="list_drafts",
            description="List Gmail drafts.",
            inputSchema={
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "default": 20}
                },
            },
        ),
        types.Tool(
            name="send_draft",
            description="Send an existing Gmail draft by its draft ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "draft_id": {"type": "string", "description": "Draft ID"}
                },
                "required": ["draft_id"],
            },
        ),
        types.Tool(
            name="delete_draft",
            description="Delete a Gmail draft.",
            inputSchema={
                "type": "object",
                "properties": {
                    "draft_id": {"type": "string", "description": "Draft ID"}
                },
                "required": ["draft_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    svc = _build_service()

    def _err(msg):
        return [types.TextContent(type="text", text=json.dumps({"error": msg}))]

    def _ok(data):
        return [types.TextContent(type="text", text=json.dumps(data))]

    if svc is None:
        return _err("Gmail not connected — check Google credentials in .env")

    if name == "fetch_inbox":
        max_r = int(arguments.get("max_results", 20))
        results = svc.users().messages().list(
            userId="me", labelIds=["INBOX"], maxResults=max_r
        ).execute()
        emails = []
        for msg in results.get("messages", []):
            full = svc.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            ).execute()
            headers = {h["name"].lower(): h["value"] for h in full.get("payload", {}).get("headers", [])}
            labels = full.get("labelIds", [])
            emails.append({
                "id": msg["id"],
                "from": headers.get("from", ""),
                "subject": headers.get("subject", "(no subject)"),
                "snippet": full.get("snippet", ""),
                "time": _humanize(headers.get("date", "")),
                "unread": "UNREAD" in labels,
                "urgent": "IMPORTANT" in labels,
            })
        return _ok(emails)

    elif name == "get_email":
        full = svc.users().messages().get(
            userId="me", id=arguments["email_id"], format="full"
        ).execute()
        return _ok(full)

    elif name == "search_emails":
        results = svc.users().messages().list(
            userId="me", q=arguments["query"],
            maxResults=int(arguments.get("max_results", 10)),
        ).execute()
        return _ok(results.get("messages", []))

    elif name == "get_counts":
        unread = svc.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD"], maxResults=1
        ).execute()
        urgent = svc.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD", "IMPORTANT"], maxResults=1
        ).execute()
        return _ok({
            "unread": unread.get("resultSizeEstimate", 0),
            "urgent": urgent.get("resultSizeEstimate", 0),
        })

    elif name == "create_draft":
        to = arguments["to"]
        if "@" not in to:
            return _err(f"Invalid email address '{to}' — full address required")
        mime = MIMEText(arguments["body"])
        mime["to"] = to
        mime["subject"] = arguments["subject"]
        raw = base64.urlsafe_b64encode(mime.as_bytes()).decode()
        draft = svc.users().drafts().create(
            userId="me", body={"message": {"raw": raw}}
        ).execute()
        return _ok({"draft_id": draft.get("id"), "to": to, "subject": arguments["subject"]})

    elif name == "list_drafts":
        result = svc.users().drafts().list(
            userId="me", maxResults=int(arguments.get("max_results", 20))
        ).execute()
        drafts = []
        for d in result.get("drafts", []):
            full = svc.users().drafts().get(userId="me", id=d["id"], format="metadata").execute()
            msg = full.get("message", {})
            headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            drafts.append({
                "id": d["id"],
                "to": headers.get("to", ""),
                "subject": headers.get("subject", "(no subject)"),
                "snippet": msg.get("snippet", ""),
            })
        return _ok(drafts)

    elif name == "send_draft":
        sent = svc.users().drafts().send(
            userId="me", body={"id": arguments["draft_id"]}
        ).execute()
        return _ok({"success": True, "message_id": sent.get("id")})

    elif name == "delete_draft":
        svc.users().drafts().delete(userId="me", id=arguments["draft_id"]).execute()
        return _ok({"success": True, "deleted": arguments["draft_id"]})

    return _err(f"Unknown tool: {name}")


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="fabric-gmail",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
