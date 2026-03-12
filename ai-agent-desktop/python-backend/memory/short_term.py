from collections import defaultdict
from typing import Any


class ShortTermContext:
    """
    In-process dict keyed by workflow_id.
    Ephemeral — cleared when workflow finishes.
    Swap for Redis for distributed workers.
    """

    def __init__(self):
        self._store: dict[str, dict[str, Any]] = defaultdict(dict)

    def get(self, workflow_id: str) -> dict[str, Any]:
        return dict(self._store.get(workflow_id, {}))

    def set(self, workflow_id: str, key: str, value: Any) -> None:
        self._store[workflow_id][key] = value

    def clear(self, workflow_id: str) -> None:
        self._store.pop(workflow_id, None)

    def all_workflows(self) -> list[str]:
        return list(self._store.keys())
