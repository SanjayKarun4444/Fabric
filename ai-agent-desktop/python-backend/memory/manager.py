from memory.short_term import ShortTermContext
from memory.long_term import LongTermStore
from typing import Any, Optional


class MemoryManager:
    """
    Unified facade over short-term (per-workflow) and long-term (persistent) memory.
    Agents never touch storage directly — only through this interface.
    """

    def __init__(self):
        self.short_term = ShortTermContext()
        self.long_term = LongTermStore()

    async def get_context(self, workflow_id: str) -> dict[str, Any]:
        """Merge per-workflow ephemeral state with persistent user context."""
        short = self.short_term.get(workflow_id)
        long = await self.long_term.get_user_context()
        # Short-term context takes precedence
        return {**long, **short}

    async def set_context(self, workflow_id: str, key: str, value: Any) -> None:
        self.short_term.set(workflow_id, key, value)

    def clear_workflow(self, workflow_id: str) -> None:
        self.short_term.clear(workflow_id)

    async def remember(self, key: str, value: Any) -> None:
        """Persist a fact that survives across sessions."""
        await self.long_term.store(key, value)

    async def recall(self, key: str) -> Optional[Any]:
        return await self.long_term.get(key)

    async def forget(self, key: str) -> None:
        await self.long_term.delete(key)
