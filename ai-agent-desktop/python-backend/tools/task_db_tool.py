import aiosqlite
import json
import uuid
from tools.base_tool import BaseTool, ToolResult
from config import settings
from observability.logger import get_logger
from datetime import datetime

_logger = get_logger("task_db_tool")


class TaskDBTool(BaseTool):
    """SQLite-backed task store."""

    def __init__(self):
        self._db_path = settings.db_path

    @property
    def name(self) -> str:
        return "task_db"

    @property
    def description(self) -> str:
        return "Local task database — create, read, update, delete tasks"

    async def execute(self, action: str, **kwargs) -> ToolResult:
        handlers = {
            "list": self._list,
            "create": self._create,
            "update": self._update,
            "delete": self._delete,
            "get": self._get,
            "list_overdue": self._list_overdue,
            "list_high_priority": self._list_high_priority,
        }
        handler = handlers.get(action)
        if not handler:
            return ToolResult(success=False, error=f"Unknown TaskDB action: {action}")
        try:
            return await handler(**kwargs)
        except Exception as e:
            _logger.error(f"TaskDBTool.{action} error: {e}")
            return ToolResult(success=False, error=str(e))

    async def _list(self, status: str = None, **_) -> ToolResult:
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            if status:
                cur = await db.execute("SELECT * FROM tasks WHERE status = ? ORDER BY priority, created_at DESC", (status,))
            else:
                cur = await db.execute("SELECT * FROM tasks ORDER BY priority, created_at DESC")
            rows = await cur.fetchall()
            return ToolResult(success=True, data=[dict(r) for r in rows])

    async def _get(self, task_id: str, **_) -> ToolResult:
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = await cur.fetchone()
            return ToolResult(success=True, data=dict(row) if row else None)

    async def _create(self, title: str, priority: str = "medium",
                      description: str = "", due_date: str = None,
                      tags: list = None, **_) -> ToolResult:
        task_id = str(uuid.uuid4())
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO tasks (id, title, description, priority, due_date, tags) VALUES (?, ?, ?, ?, ?, ?)",
                (task_id, title, description, priority, due_date, json.dumps(tags or [])),
            )
            await db.commit()
        return ToolResult(success=True, data={"id": task_id, "title": title})

    async def _update(self, task_id: str, **kwargs) -> ToolResult:
        allowed = {"title", "description", "priority", "status", "due_date", "tags"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return ToolResult(success=False, error="No valid fields to update")

        if "tags" in updates and isinstance(updates["tags"], list):
            updates["tags"] = json.dumps(updates["tags"])

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [datetime.utcnow().isoformat(), task_id]

        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                f"UPDATE tasks SET {set_clause}, updated_at = ? WHERE id = ?", values
            )
            await db.commit()
        return ToolResult(success=True, data={"id": task_id, "updated": list(updates.keys())})

    async def _delete(self, task_id: str, **_) -> ToolResult:
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            await db.commit()
        return ToolResult(success=True, data={"id": task_id})

    async def _list_overdue(self, **_) -> ToolResult:
        today = datetime.utcnow().date().isoformat()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM tasks WHERE due_date < ? AND status != 'completed' ORDER BY due_date",
                (today,),
            )
            rows = await cur.fetchall()
            return ToolResult(success=True, data=[dict(r) for r in rows])

    async def _list_high_priority(self, **_) -> ToolResult:
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM tasks WHERE priority = 'high' AND status != 'completed' ORDER BY due_date"
            )
            rows = await cur.fetchall()
            return ToolResult(success=True, data=[dict(r) for r in rows])
