from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags=["health"])


def make_router(registry, ws_manager):
    @router.get("/health")
    async def health():
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "agents": len(registry.all()),
            "ws_connections": ws_manager.connected_count,
        }

    @router.get("/api/v1/status")
    async def status():
        agents = registry.get_summary()
        active = [a for a in agents if a["status"] == "running"]
        return {
            "connected": True,
            "active_agents": [a["name"] for a in active],
            "total_agents": len(agents),
            "last_update": datetime.utcnow().isoformat() + "Z",
            "agent_ready": True,
        }

    return router
