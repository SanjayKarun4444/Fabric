import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from models.events import Event, EventType
from observability.logger import get_logger

_logger = get_logger("websocket")


class ConnectionManager:
    """Manages all active WebSocket connections from the Electron UI."""

    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        _logger.info(f"WebSocket connected. Total: {len(self._connections)}")

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        _logger.info(f"WebSocket disconnected. Total: {len(self._connections)}")

    async def broadcast(self, data: dict) -> None:
        dead: set[WebSocket] = set()
        for ws in self._connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    @property
    def connected_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


async def ws_endpoint(websocket: WebSocket, orchestrator, event_bus, registry) -> None:
    await manager.connect(websocket)

    # Forward every event to the UI
    async def forward_event(event: Event) -> None:
        await manager.broadcast(event.to_ws_message())

    for et in EventType:
        event_bus.subscribe(et, forward_event)

    # Send initial agent states so the UI hydrates immediately
    try:
        await websocket.send_json({
            "type": "init",
            "agents": registry.get_summary(),
        })
    except Exception:
        pass

    try:
        while True:
            msg = await websocket.receive_json()
            await _handle_message(msg, websocket, orchestrator, registry)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        _logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def _handle_message(msg: dict, ws: WebSocket, orchestrator, registry) -> None:
    msg_type = msg.get("type")

    if msg_type == "command":
        # User sends a command: {type: "command", command: "triage_inbox", parameters: {}}
        try:
            task_id = await orchestrator.dispatch(
                intent=msg["command"],
                parameters=msg.get("parameters", {}),
            )
            await ws.send_json({"type": "ack", "task_id": task_id, "command": msg["command"]})
        except Exception as e:
            await ws.send_json({"type": "error", "message": str(e)})

    elif msg_type == "chat":
        # Chat message: {type: "chat", message: "...", conversation_id: "..."}
        try:
            task_id = await orchestrator.dispatch(
                intent="user_chat",
                parameters={"message": msg["message"]},
                agent_name="assistant_agent",
            )
            await ws.send_json({"type": "ack", "task_id": task_id})
        except Exception as e:
            await ws.send_json({"type": "error", "message": str(e)})

    elif msg_type == "run_workflow":
        # Named workflow: {type: "run_workflow", workflow: "prepare_for_tomorrow"}
        workflow = msg.get("workflow", "")
        try:
            asyncio.create_task(orchestrator.run_named_workflow(workflow))
            await ws.send_json({"type": "ack", "workflow": workflow})
        except ValueError as e:
            await ws.send_json({"type": "error", "message": str(e)})

    elif msg_type == "pause_agent":
        name = msg.get("agent")
        success = registry.pause_agent(name)
        await ws.send_json({"type": "ack", "action": "pause", "agent": name, "success": success})

    elif msg_type == "resume_agent":
        name = msg.get("agent")
        success = registry.resume_agent(name)
        await ws.send_json({"type": "ack", "action": "resume", "agent": name, "success": success})

    elif msg_type == "get_agents":
        await ws.send_json({"type": "agents", "agents": registry.get_summary()})

    elif msg_type == "ping":
        await ws.send_json({"type": "pong"})
