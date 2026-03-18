#!/usr/bin/env python3
"""
MCP server — Task Database (SQLite)
Exposes: list_tasks, create_task, update_task, delete_task, list_overdue, list_high_priority
Run standalone: python -m tools.mcp.task_server
"""

import asyncio
import json
import os
import uuid
from datetime import datetime

import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

server = Server("fabric-tasks")

_DB_PATH = os.environ.get("DB_PATH", "fabric.db")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_tasks",
            description="List tasks from the local task database, optionally filtered by status.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: pending, in_progress, completed. Omit for all.",
                    }
                },
            },
        ),
        types.Tool(
            name="create_task",
            description="Create a new task in the local task database.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title"},
                    "description": {"type": "string", "description": "Task details"},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "Priority level. Default medium.",
                        "default": "medium",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date YYYY-MM-DD",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional tags",
                    },
                },
                "required": ["title"],
            },
        ),
        types.Tool(
            name="update_task",
            description="Update fields on an existing task.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed"],
                    },
                    "due_date": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["task_id"],
            },
        ),
        types.Tool(
            name="delete_task",
            description="Delete a task by its ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID"}
                },
                "required": ["task_id"],
            },
        ),
        types.Tool(
            name="list_overdue",
            description="List all tasks that are past their due date and not completed.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="list_high_priority",
            description="List all high-priority tasks that are not completed.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    import aiosqlite

    db_path = _DB_PATH

    def _ok(data):
        return [types.TextContent(type="text", text=json.dumps(data))]

    def _err(msg):
        return [types.TextContent(type="text", text=json.dumps({"error": msg}))]

    try:
        if name == "list_tasks":
            async with aiosqlite.connect(db_path) as db:
                db.row_factory = aiosqlite.Row
                status = arguments.get("status")
                if status:
                    cur = await db.execute(
                        "SELECT * FROM tasks WHERE status = ? ORDER BY priority, created_at DESC",
                        (status,),
                    )
                else:
                    cur = await db.execute(
                        "SELECT * FROM tasks ORDER BY priority, created_at DESC"
                    )
                rows = await cur.fetchall()
                return _ok([dict(r) for r in rows])

        elif name == "create_task":
            task_id = str(uuid.uuid4())
            tags = arguments.get("tags") or []
            async with aiosqlite.connect(db_path) as db:
                await db.execute(
                    "INSERT INTO tasks (id, title, description, priority, due_date, tags) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        task_id,
                        arguments["title"],
                        arguments.get("description", ""),
                        arguments.get("priority", "medium"),
                        arguments.get("due_date"),
                        json.dumps(tags),
                    ),
                )
                await db.commit()
            return _ok({"success": True, "id": task_id, "title": arguments["title"]})

        elif name == "update_task":
            allowed = {"title", "description", "priority", "status", "due_date", "tags"}
            updates = {k: v for k, v in arguments.items() if k in allowed}
            if not updates:
                return _err("No valid fields to update")
            if "tags" in updates and isinstance(updates["tags"], list):
                updates["tags"] = json.dumps(updates["tags"])
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [datetime.utcnow().isoformat(), arguments["task_id"]]
            async with aiosqlite.connect(db_path) as db:
                await db.execute(
                    f"UPDATE tasks SET {set_clause}, updated_at = ? WHERE id = ?",
                    values,
                )
                await db.commit()
            return _ok({"success": True, "id": arguments["task_id"], "updated": list(updates.keys())})

        elif name == "delete_task":
            async with aiosqlite.connect(db_path) as db:
                await db.execute("DELETE FROM tasks WHERE id = ?", (arguments["task_id"],))
                await db.commit()
            return _ok({"success": True, "deleted": arguments["task_id"]})

        elif name == "list_overdue":
            today = datetime.utcnow().date().isoformat()
            async with aiosqlite.connect(db_path) as db:
                db.row_factory = aiosqlite.Row
                cur = await db.execute(
                    "SELECT * FROM tasks WHERE due_date < ? AND status != 'completed' ORDER BY due_date",
                    (today,),
                )
                rows = await cur.fetchall()
                return _ok([dict(r) for r in rows])

        elif name == "list_high_priority":
            async with aiosqlite.connect(db_path) as db:
                db.row_factory = aiosqlite.Row
                cur = await db.execute(
                    "SELECT * FROM tasks WHERE priority = 'high' AND status != 'completed' ORDER BY due_date"
                )
                rows = await cur.fetchall()
                return _ok([dict(r) for r in rows])

        return _err(f"Unknown tool: {name}")

    except Exception as e:
        return _err(str(e))


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="fabric-tasks",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
