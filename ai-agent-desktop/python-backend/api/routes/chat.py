from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = "default"


def make_router(orchestrator):
    @router.post("")
    async def chat(req: ChatRequest):
        task_id = await orchestrator.dispatch(
            intent="user_chat",
            parameters={"message": req.message, "conversation_id": req.conversation_id},
            agent_name="assistant_agent",
        )
        return {"task_id": task_id, "status": "processing"}

    return router
