from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


class DispatchRequest(BaseModel):
    intent: str
    parameters: dict[str, Any] = {}
    agent_name: Optional[str] = None
    priority: int = 2  # NORMAL


class WorkflowRequest(BaseModel):
    workflow: str


def make_router(orchestrator, registry):
    @router.get("")
    async def list_agents():
        return {"agents": registry.get_summary()}

    @router.get("/{name}")
    async def get_agent(name: str):
        agent = registry.get(name)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
        return agent.state.model_dump(mode="json")

    @router.post("/{name}/pause")
    async def pause_agent(name: str):
        success = registry.pause_agent(name)
        return {"success": success, "agent": name, "status": "paused"}

    @router.post("/{name}/resume")
    async def resume_agent(name: str):
        success = registry.resume_agent(name)
        return {"success": success, "agent": name, "status": "idle"}

    @router.post("/dispatch")
    async def dispatch(req: DispatchRequest):
        from core.task_queue import TaskPriority
        priority = TaskPriority(req.priority)
        task_id = await orchestrator.dispatch(
            intent=req.intent,
            parameters=req.parameters,
            agent_name=req.agent_name,
            priority=priority,
        )
        return {"task_id": task_id, "status": "queued"}

    @router.post("/workflow/run")
    async def run_workflow(req: WorkflowRequest):
        import asyncio
        asyncio.create_task(orchestrator.run_named_workflow(req.workflow))
        return {"workflow": req.workflow, "status": "started"}

    return router
