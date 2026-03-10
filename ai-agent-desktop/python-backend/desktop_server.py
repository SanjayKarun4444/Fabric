from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
from datetime import datetime

app = FastAPI(title="AI Agent Desktop Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = None

class CommandRequest(BaseModel):
    command: str
    args: Optional[Dict[str, Any]] = {}

@app.on_event("startup")
async def startup():
    print("Starting AI Agent Desktop Backend...")
    print("Backend ready")

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "agent_ready": True}

@app.post("/agent/execute")
async def execute_command(request: CommandRequest):
    try:
        result = await handle_command(request.command, request.args)
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "error": str(e)}

async def handle_command(command: str, args: Dict[str, Any]) -> Dict[str, Any]:
    if command == "ping":
        return {"success": True, "result": {"status": "ok"}}
    
    elif command == "get_summary":
        return {
            "success": True,
            "result": {
                "email": {"urgent": 3, "unread": 12},
                "calendar": {"meetings": 4, "next_meeting": {"title": "Team Standup", "time": "10:00 AM"}},
                "tasks": {"high": 5, "total": 15},
                "recent_activity": [
                    {"type": "email", "message": "New email from boss@company.com", "timestamp": datetime.now().isoformat()}
                ]
            }
        }
    
    elif command == "triage_inbox":
        await asyncio.sleep(1)
        return {"success": True, "result": {"summary": "Processed 47 emails: 3 urgent, 12 important"}}
    
    elif command == "morning_routine":
        await asyncio.sleep(2)
        return {"success": True, "result": {"summary": "Good morning! 3 meetings today, 5 high-priority tasks"}}
    
    elif command == "daily_summary":
        return {"success": True, "result": {"summary": "Today: 4 meetings, 8 tasks completed"}}
    
    elif command == "get_tasks":
        return {
            "success": True,
            "result": {
                "tasks": [
                    {"id": "1", "title": "Review Q1 budget", "priority": "high", "completed": False, "due_date": "2024-12-31"},
                    {"id": "2", "title": "Team meeting prep", "priority": "medium", "completed": False, "due_date": "2024-12-20"}
                ]
            }
        }
    
    elif command == "get_emails":
        return {
            "success": True,
            "result": {
                "emails": [
                    {"id": "1", "from": "boss@company.com", "subject": "Q1 Budget Review", "snippet": "Please review...", "time": "2 hours ago", "priority": "urgent", "body": "Please review the attached Q1 budget analysis."},
                    {"id": "2", "from": "team@company.com", "subject": "Sprint Planning", "snippet": "Sprint planning...", "time": "4 hours ago", "priority": "normal", "body": "Sprint planning meeting tomorrow at 2 PM."}
                ]
            }
        }
    
    elif command == "get_calendar_events":
        return {
            "success": True,
            "result": {
                "events": [
                    {"id": "1", "title": "Team Standup", "time": "10:00 AM", "location": "Conference Room A", "attendees": ["alice@company.com"]},
                    {"id": "2", "title": "Client Call", "time": "2:00 PM", "attendees": ["client@example.com"]}
                ]
            }
        }
    
    elif command == "chat":
        message = args.get("message", "")
        return {"success": True, "result": {"response": f"I understand: '{message}'. I'm here to help!"}}
    
    elif command in ["add_task", "toggle_task", "delete_task", "check_new_emails", "evening_routine", "draft_reply"]:
        return {"success": True}
    
    else:
        return {"success": False, "error": f"Unknown command: {command}"}

@app.get("/agent/status")
async def get_status():
    return {"connected": True, "active_agents": ["email", "calendar", "tasks"], "last_action": datetime.now().isoformat()}

if __name__ == "__main__":
    import os
    port = int(os.getenv("BACKEND_PORT", 3001))
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    print(f"Starting server on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, log_level="info")
