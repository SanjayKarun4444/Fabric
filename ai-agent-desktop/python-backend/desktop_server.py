"""
Fabric AI Desktop — Python Backend v2.0
FastAPI server with multi-agent architecture.
Entry: uvicorn desktop_server:app --host 127.0.0.1 --port 3001
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from observability.logger import get_logger
from db.sqlite import init_db

from core.event_bus import EventBus
from core.task_queue import TaskQueue
from core.registry import AgentRegistry
from core.orchestrator import AgentOrchestrator
from core.scheduler import Scheduler

from memory.manager import MemoryManager

from tools.registry import ToolRegistry
from tools.claude_tool import ClaudeTool
from tools.gmail_tool import GmailTool
from tools.calendar_tool import CalendarTool
from tools.search_tool import SearchTool
from tools.task_db_tool import TaskDBTool

from agents.email_agent import EmailAgent
from agents.calendar_agent import CalendarAgent
from agents.task_agent import TaskAgent
from agents.research_agent import ResearchAgent
from agents.finance_agent import FinanceAgent
from agents.assistant_agent import AssistantAgent

from api.websocket import ws_endpoint, manager as ws_manager
from api.routes.agents import make_router as make_agents_router
from api.routes.chat import make_router as make_chat_router
from api.routes.health import make_router as make_health_router

from typing import Optional, Dict, Any
import asyncio
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
_logger = get_logger("server")

# ── Google service lazy loaders ───────────────────────────────────────────────

_gmail_service = None
_calendar_service = None


def _get_gmail_service():
    global _gmail_service
    if _gmail_service is not None:
        return _gmail_service
    client_id = settings.google_client_id
    client_secret = settings.google_client_secret
    refresh_token = settings.google_refresh_token
    if not all([client_id, client_secret, refresh_token]):
        return None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        creds = Credentials(
            token=None, refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id, client_secret=client_secret,
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.compose",
            ],
        )
        _gmail_service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return _gmail_service
    except Exception as e:
        _logger.error(f"Gmail init error: {e}")
        return None


def _get_calendar_service():
    global _calendar_service
    if _calendar_service is not None:
        return _calendar_service
    client_id = settings.google_client_id
    client_secret = settings.google_client_secret
    refresh_token = settings.google_refresh_token
    if not all([client_id, client_secret, refresh_token]):
        return None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        creds = Credentials(
            token=None, refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id, client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        _calendar_service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        return _calendar_service
    except Exception as e:
        _logger.error(f"Calendar init error: {e}")
        return None


# ── App singletons ─────────────────────────────────────────────────────────────

_event_bus: Optional[EventBus] = None
_orchestrator: Optional[AgentOrchestrator] = None
_registry: Optional[AgentRegistry] = None
_scheduler: Optional[Scheduler] = None
_tools: Optional[ToolRegistry] = None


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _event_bus, _orchestrator, _registry, _scheduler, _tools

    _logger.info("Starting Fabric AI backend...")

    await init_db()

    _event_bus = EventBus()
    task_queue = TaskQueue()
    memory = MemoryManager()

    _tools = ToolRegistry()
    _tools.register(ClaudeTool())
    _tools.register(GmailTool(_get_gmail_service))
    _tools.register(CalendarTool(_get_calendar_service))
    _tools.register(SearchTool())
    _tools.register(TaskDBTool())

    _registry = AgentRegistry()
    _orchestrator = AgentOrchestrator(_registry, _event_bus, task_queue, memory)

    _registry.register(EmailAgent(_tools, memory, _event_bus))
    _registry.register(CalendarAgent(_tools, memory, _event_bus))
    _registry.register(TaskAgent(_tools, memory, _event_bus))
    _registry.register(ResearchAgent(_tools, memory, _event_bus))
    _registry.register(FinanceAgent(_tools, memory, _event_bus))
    _registry.register(AssistantAgent(_tools, memory, _event_bus, _orchestrator))

    _scheduler = Scheduler()
    from models.events import Event, EventType

    async def _morning():
        await _event_bus.publish(Event(type=EventType.MORNING_ROUTINE, payload={}, source="scheduler"))

    async def _daily():
        await _event_bus.publish(Event(type=EventType.DAILY_SUMMARY_REQUESTED, payload={}, source="scheduler"))

    async def _evening():
        await _event_bus.publish(Event(type=EventType.EVENING_ROUTINE, payload={}, source="scheduler"))

    _scheduler.add_job("morning_routine", _morning, hour=7)
    _scheduler.add_job("daily_summary", _daily, hour=17)
    _scheduler.add_job("evening_routine", _evening, hour=18)

    await _event_bus.start()
    await _orchestrator.start(workers=settings.task_queue_workers)
    await _scheduler.start()

    _logger.info(f"Fabric AI backend ready — agents: {[a.name for a in _registry.all()]}")

    yield

    _logger.info("Shutting down Fabric AI backend...")
    await _scheduler.stop()
    await _orchestrator.stop()
    await _event_bus.stop()


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(title="Fabric AI Desktop", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await ws_endpoint(websocket, _orchestrator, _event_bus, _registry)


@app.on_event("startup")
async def _attach_routes():
    app.include_router(make_agents_router(_orchestrator, _registry))
    app.include_router(make_chat_router(_orchestrator))
    app.include_router(make_health_router(_registry, ws_manager))


# ── Legacy /agent/execute (Electron IPC backward-compat) ──────────────────────

from pydantic import BaseModel


class CommandRequest(BaseModel):
    command: str
    args: Optional[Dict[str, Any]] = {}


@app.post("/agent/execute")
async def execute_command(request: CommandRequest):
    try:
        return await _handle_legacy_command(request.command, request.args or {})
    except Exception as e:
        _logger.error(f"Command error [{request.command}]: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@app.get("/agent/status")
async def legacy_status():
    if _registry is None:
        return {"connected": False, "active_agents": [], "last_action": None, "agent_ready": False}
    agents = _registry.get_summary()
    return {
        "connected": True,
        "active_agents": [a["name"] for a in agents],
        "last_action": datetime.utcnow().isoformat(),
        "agent_ready": True,
    }


@app.get("/health")
async def legacy_health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "agent_ready": _orchestrator is not None,
    }


async def _handle_legacy_command(command: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """Maps old flat commands to the new agent/orchestrator system."""

    if command == "ping":
        return {"success": True, "result": {"status": "ok"}}

    workflow_map = {
        "morning_routine": "morning_routine",
        "evening_routine": "daily_summary",
        "daily_summary": "daily_summary",
        "prepare_for_tomorrow": "prepare_for_tomorrow",
        "handle_inbox": "handle_inbox",
    }
    if command in workflow_map:
        wf = workflow_map[command]
        asyncio.create_task(_orchestrator.run_named_workflow(wf))
        return {"success": True, "result": {"status": "workflow_started", "workflow": wf}}

    agent_map = {
        "triage_inbox": ("email_agent", "triage_inbox"),
        "draft_reply": ("email_agent", "draft_reply"),
    }
    if command in agent_map:
        agent_name, intent = agent_map[command]
        task_id = await _orchestrator.dispatch(intent=intent, parameters=args, agent_name=agent_name)
        return {"success": True, "result": {"task_id": task_id, "status": "queued"}}

    if command == "get_summary":
        return await _get_summary()

    if command == "get_emails":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="fetch_inbox", max_results=args.get("max_results", 20))
        return {"success": r.success, "result": {"emails": r.data,
                "source": "gmail" if _get_gmail_service() else "stub"}}

    if command == "get_calendar_events":
        cal = CalendarTool(_get_calendar_service)
        r = await cal.execute(action="list_events", date=args.get("date"))
        return {"success": r.success, "result": {"events": r.data,
                "source": "google_calendar" if _get_calendar_service() else "stub"}}

    if command == "create_calendar_event":
        cal = CalendarTool(_get_calendar_service)
        r = await cal.execute(
            action="create_event",
            title=args.get("title", "New Event"),
            date=args.get("date"),
            start_time=args.get("start_time"),
            end_time=args.get("end_time"),
            description=args.get("description", ""),
        )
        return {"success": r.success, "result": r.data, "error": r.error}

    if command == "get_tasks":
        db = TaskDBTool()
        r = await db.execute(action="list")
        return {"success": r.success, "result": {"tasks": r.data or []}}

    if command == "add_task":
        db = TaskDBTool()
        r = await db.execute(
            action="create",
            title=args.get("title", "New Task"),
            priority=args.get("priority", "medium"),
            description=args.get("description", ""),
            due_date=args.get("due_date"),
        )
        return {"success": r.success, "result": r.data}

    if command == "toggle_task":
        task_id = await _orchestrator.dispatch(
            intent="toggle_task",
            parameters={"task_id": args.get("task_id")},
            agent_name="task_agent",
        )
        return {"success": True, "result": {"queued": task_id}}

    if command == "delete_task":
        db = TaskDBTool()
        r = await db.execute(action="delete", task_id=args.get("task_id"))
        return {"success": r.success, "result": r.data}

    if command == "chat":
        task_id = await _orchestrator.dispatch(
            intent="user_chat",
            parameters={"message": args.get("message", "")},
            agent_name="assistant_agent",
        )
        return {"success": True, "result": {"task_id": task_id, "status": "processing",
                "response": "I'm on it — check back in a moment."}}

    if command == "list_drafts":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="list_drafts", max_results=args.get("max_results", 20))
        return {"success": r.success, "result": {"drafts": r.data or []}, "error": r.error}

    if command == "get_draft":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="get_draft", draft_id=args.get("draft_id", ""))
        return {"success": r.success, "result": r.data, "error": r.error}

    if command == "update_draft":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(
            action="update_draft",
            draft_id=args.get("draft_id", ""),
            to=args.get("to", ""),
            subject=args.get("subject", ""),
            body=args.get("body", ""),
        )
        return {"success": r.success, "result": r.data, "error": r.error}

    if command == "send_draft":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="send_draft", draft_id=args.get("draft_id", ""))
        return {"success": r.success, "result": r.data, "error": r.error}

    if command == "delete_draft":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="delete_draft", draft_id=args.get("draft_id", ""))
        return {"success": r.success, "result": r.data, "error": r.error}

    if command == "check_new_emails":
        gmail = GmailTool(_get_gmail_service)
        r = await gmail.execute(action="get_counts")
        return {"success": r.success, "result": r.data}

    if command == "get_agents":
        if _registry is None:
            return {"success": False, "error": "Registry not ready"}
        return {"success": True, "result": {"agents": _registry.get_summary()}}

    if command == "run_workflow":
        workflow = args.get("workflow", "")
        if not workflow:
            return {"success": False, "error": "workflow name required"}
        asyncio.create_task(_orchestrator.run_named_workflow(workflow))
        return {"success": True, "result": {"status": "started", "workflow": workflow}}

    return {"success": False, "error": f"Unknown command: {command}"}


async def _get_summary() -> Dict[str, Any]:
    gmail = GmailTool(_get_gmail_service)
    cal = CalendarTool(_get_calendar_service)
    db = TaskDBTool()

    counts_r, events_r, tasks_r = await asyncio.gather(
        gmail.execute(action="get_counts"),
        cal.execute(action="list_events"),
        db.execute(action="list", status="pending"),
        return_exceptions=True,
    )

    email_summary = {"urgent": 0, "unread": 0}
    if not isinstance(counts_r, Exception) and counts_r.success:
        email_summary = counts_r.data or email_summary

    cal_summary = {"meetings": 0, "next_meeting": None}
    if not isinstance(events_r, Exception) and events_r.success:
        events = events_r.data or []
        cal_summary["meetings"] = len(events)
        now_str = datetime.now().strftime("%H:%M")
        upcoming = [e for e in events if e.get("time", "") >= now_str and e.get("time") != "All day"]
        if upcoming:
            cal_summary["next_meeting"] = {"title": upcoming[0]["title"], "time": upcoming[0]["time"]}

    task_summary = {"high": 0, "total": 0}
    if not isinstance(tasks_r, Exception) and tasks_r.success:
        tasks = tasks_r.data or []
        task_summary["total"] = len(tasks)
        task_summary["high"] = len([t for t in tasks if t.get("priority") == "high"])

    return {
        "success": True,
        "result": {
            "email": email_summary,
            "calendar": cal_summary,
            "tasks": task_summary,
            "recent_activity": [
                {"type": "system", "message": "Fabric AI ready", "timestamp": datetime.utcnow().isoformat()}
            ],
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info")
