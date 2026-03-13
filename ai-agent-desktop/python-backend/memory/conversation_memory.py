"""
ConversationMemory — two-layer persistent memory for the assistant agent.

Layer 1 — SQLite:   ordered conversation history per (user_id, conversation_id).
                    Gives Claude exact recent context within a conversation.

Layer 2 — ChromaDB: semantic vector index across ALL past turns for ALL users.
                    Gives Claude relevant cross-session recall ("you mentioned X
                    last week", resolving "it"/"that" across sessions).

Each user_id maps to its own ChromaDB collection, so memory is fully isolated
and ready for multi-user / Google OAuth without any rework.
"""

import uuid
import json
import re
import os
from datetime import datetime
from typing import Optional

import aiosqlite
from observability.logger import get_logger

_logger = get_logger("conversation_memory")

try:
    import chromadb
    _CHROMA_AVAILABLE = True
except ImportError:
    _CHROMA_AVAILABLE = False
    _logger.warning(
        "chromadb not installed — semantic memory disabled. "
        "Run: pip install chromadb"
    )


def _safe_collection_name(user_id: str) -> str:
    """
    ChromaDB collection names: 3-63 chars, alphanumeric + hyphens,
    must start and end with alphanumeric.
    """
    safe = re.sub(r"[^a-zA-Z0-9-]", "-", user_id).strip("-") or "default"
    # prefix guarantees it starts with alpha; total ≤ 63 chars
    return f"cv-{safe[:57]}"


class ConversationMemory:
    def __init__(self, db_path: str, chroma_path: str):
        self._db_path = db_path
        self._chroma_path = chroma_path
        self._chroma_client = None
        self._init_chroma()

    # ── ChromaDB setup ────────────────────────────────────────────────────────

    def _init_chroma(self) -> None:
        if not _CHROMA_AVAILABLE:
            return
        try:
            os.makedirs(self._chroma_path, exist_ok=True)
            self._chroma_client = chromadb.PersistentClient(path=self._chroma_path)
            _logger.info(f"ChromaDB ready at {self._chroma_path}")
        except Exception as e:
            _logger.error(f"ChromaDB init failed: {e}")
            self._chroma_client = None

    def _get_collection(self, user_id: str):
        if self._chroma_client is None:
            return None
        try:
            return self._chroma_client.get_or_create_collection(
                name=_safe_collection_name(user_id),
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as e:
            _logger.error(f"ChromaDB get_collection failed: {e}")
            return None

    # ── Write ─────────────────────────────────────────────────────────────────

    async def add_turn(
        self,
        user_id: str,
        conversation_id: str,
        user_msg: str,
        assistant_msg: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """Persist a completed conversation turn to both storage layers."""
        turn_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        meta = metadata or {}

        # Layer 1: SQLite — ordered, queryable by conversation
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                """
                INSERT INTO conversation_turns
                    (id, user_id, conversation_id, user_msg, assistant_msg, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    turn_id, user_id, conversation_id,
                    user_msg, assistant_msg,
                    timestamp, json.dumps(meta),
                ),
            )
            await db.commit()

        # Layer 2: ChromaDB — semantic search across all history
        collection = self._get_collection(user_id)
        if collection is not None:
            try:
                doc = f"User: {user_msg}\nAssistant: {assistant_msg}"
                collection.add(
                    documents=[doc],
                    ids=[turn_id],
                    metadatas=[{
                        "conversation_id": conversation_id,
                        "timestamp": timestamp,
                        **{k: str(v) for k, v in meta.items()},
                    }],
                )
            except Exception as e:
                _logger.error(f"ChromaDB add failed: {e}")

    # ── Read ──────────────────────────────────────────────────────────────────

    async def get_recent_turns(
        self,
        user_id: str,
        conversation_id: str,
        n: int = 8,
    ) -> list[dict]:
        """
        Return the last n turns for this conversation, oldest first.
        Used to build the immediate history context for Claude.
        """
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute(
                """
                SELECT user_msg, assistant_msg, timestamp
                FROM conversation_turns
                WHERE user_id = ? AND conversation_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (user_id, conversation_id, n),
            )
            rows = await cur.fetchall()

        # DESC fetch → reverse to get chronological order
        return [
            {"user": r[0], "assistant": r[1], "timestamp": r[2]}
            for r in reversed(rows)
        ]

    async def search_similar(
        self,
        user_id: str,
        query: str,
        n: int = 3,
        exclude_conversation_id: Optional[str] = None,
    ) -> list[str]:
        """
        Semantic search over all past turns for this user.
        Returns raw document strings (formatted "User: ...\nAssistant: ...").
        Optionally excludes the current conversation to avoid duplicating
        context already surfaced by get_recent_turns.
        """
        collection = self._get_collection(user_id)
        if collection is None:
            return []
        try:
            count = collection.count()
            if count == 0:
                return []

            where = None
            if exclude_conversation_id:
                where = {"conversation_id": {"$ne": exclude_conversation_id}}

            results = collection.query(
                query_texts=[query],
                n_results=min(n, count),
                where=where if count > 1 else None,
            )
            return results["documents"][0] if results["documents"] else []
        except Exception as e:
            _logger.error(f"ChromaDB search failed: {e}")
            return []

    # ── Context builder ───────────────────────────────────────────────────────

    async def build_context(
        self,
        user_id: str,
        conversation_id: str,
        current_message: str,
    ) -> str:
        """
        Build a formatted context string to prepend to Claude's system prompt.

        Combines:
        - Recent turns from the current conversation (exact order, SQLite)
        - Semantically similar turns from past sessions (ChromaDB RAG)

        Returns an empty string when there is no history yet.
        """
        recent = await self.get_recent_turns(user_id, conversation_id, n=8)
        similar = await self.search_similar(
            user_id, current_message, n=3,
            exclude_conversation_id=conversation_id,
        )

        parts: list[str] = []

        if recent:
            lines: list[str] = []
            for turn in recent:
                lines.append(f"User: {turn['user']}")
                lines.append(f"Assistant: {turn['assistant']}")
            parts.append("## Conversation so far\n" + "\n".join(lines))

        if similar:
            parts.append(
                "## Relevant context from past sessions\n"
                + "\n\n---\n\n".join(similar)
            )

        return "\n\n".join(parts)
