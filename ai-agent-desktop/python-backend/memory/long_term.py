import aiosqlite
import json
from typing import Any, Optional
from config import settings


class LongTermStore:
    """
    Persistent key/value store backed by SQLite.
    Swap the internals for PostgreSQL or Redis without touching callers.
    """

    def __init__(self):
        self._db_path = settings.db_path

    async def store(self, key: str, value: Any) -> None:
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, datetime('now'))",
                (key, json.dumps(value)),
            )
            await db.commit()

    async def get(self, key: str) -> Optional[Any]:
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute("SELECT value FROM memory WHERE key = ?", (key,))
            row = await cur.fetchone()
            return json.loads(row[0]) if row else None

    async def delete(self, key: str) -> None:
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute("DELETE FROM memory WHERE key = ?", (key,))
            await db.commit()

    async def get_user_context(self) -> dict[str, Any]:
        """Load all persisted user-level facts (keys starting with 'user.')."""
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute("SELECT key, value FROM memory WHERE key LIKE 'user.%'")
            rows = await cur.fetchall()
            return {row[0]: json.loads(row[1]) for row in rows}

    async def get_all(self) -> dict[str, Any]:
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute("SELECT key, value FROM memory")
            rows = await cur.fetchall()
            return {row[0]: json.loads(row[1]) for row in rows}
