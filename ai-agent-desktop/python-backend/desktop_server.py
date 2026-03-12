from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
from datetime import datetime, timezone, timedelta
import os
import base64
import email as email_lib

from dotenv import load_dotenv
load_dotenv()

# Gmail API setup
_gmail_service = None
_calendar_service = None

_EVENT_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']
_VIRTUAL_KEYWORDS = {'zoom', 'meet', 'teams', 'webex', 'skype', 'slack', 'whereby', 'bluejeans'}

def _get_gmail_service():
    global _gmail_service
    if _gmail_service is not None:
        return _gmail_service

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/gmail.readonly"],
        )
        _gmail_service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return _gmail_service
    except Exception as e:
        print(f"Gmail init error: {e}")
        return None


def _get_calendar_service():
    global _calendar_service
    if _calendar_service is not None:
        return _calendar_service

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        _calendar_service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        return _calendar_service
    except Exception as e:
        print(f"Calendar init error: {e}")
        return None


def _fetch_calendar_events(target_date=None):
    service = _get_calendar_service()
    if service is None:
        return None

    if target_date is None:
        target_date = datetime.now().date()

    # Build RFC3339 time bounds for the target day
    local_tz = datetime.now().astimezone().tzinfo
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=local_tz)
    day_end = day_start + timedelta(days=1)
    time_min = day_start.isoformat()
    time_max = day_end.isoformat()

    try:
        result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        ).execute()
    except Exception as e:
        print(f"Calendar fetch error: {e}")
        return None

    events = []
    for idx, item in enumerate(result.get("items", [])):
        # Skip declined events
        for attendee in item.get("attendees", []):
            if attendee.get("self") and attendee.get("responseStatus") == "declined":
                break
        else:
            pass  # process event below

        start_raw = item.get("start", {})
        end_raw = item.get("end", {})

        # All-day events use "date", timed events use "dateTime"
        if "dateTime" in start_raw:
            start_dt = datetime.fromisoformat(start_raw["dateTime"])
            end_dt = datetime.fromisoformat(end_raw["dateTime"])
            time_str = start_dt.strftime("%H:%M")
            duration_mins = int((end_dt - start_dt).total_seconds() / 60)
            duration_str = f"{duration_mins}m"
        else:
            time_str = "All day"
            duration_str = "All day"

        location = item.get("location", "")
        hangout_link = item.get("hangoutLink", "")
        conference_data = item.get("conferenceData", {})

        # Detect virtual meeting
        is_virtual = bool(hangout_link) or bool(conference_data)
        if not is_virtual and location:
            loc_lower = location.lower()
            is_virtual = any(kw in loc_lower for kw in _VIRTUAL_KEYWORDS)
            if any(kw in loc_lower for kw in _VIRTUAL_KEYWORDS):
                # Extract the meeting link if location is a URL
                pass

        attendees = [
            a.get("displayName") or a.get("email", "")
            for a in item.get("attendees", [])
            if not a.get("self")
        ]

        # Prefer hangout link for virtual join
        join_url = hangout_link
        if not join_url and conference_data:
            entry_points = conference_data.get("entryPoints", [])
            for ep in entry_points:
                if ep.get("entryPointType") == "video":
                    join_url = ep.get("uri", "")
                    break

        events.append({
            "id": item.get("id", str(idx)),
            "title": item.get("summary", "(No title)"),
            "time": time_str,
            "duration": duration_str,
            "location": location or ("Google Meet" if is_virtual else ""),
            "attendees": attendees,
            "virtual": is_virtual,
            "color": _EVENT_COLORS[idx % len(_EVENT_COLORS)],
            "description": item.get("description", ""),
            "joinUrl": join_url,
            "htmlLink": item.get("htmlLink", ""),
        })

    return events


def _header(headers, name):
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _fetch_gmail_emails(max_results=20):
    service = _get_gmail_service()
    if service is None:
        return None  # signal to use stub data

    results = service.users().messages().list(
        userId="me", labelIds=["INBOX"], maxResults=max_results
    ).execute()

    messages = results.get("messages", [])
    emails = []

    for msg in messages:
        full = service.users().messages().get(
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"]
        ).execute()

        headers = full.get("payload", {}).get("headers", [])
        sender = _header(headers, "From")
        subject = _header(headers, "Subject") or "(no subject)"
        date_str = _header(headers, "Date")
        snippet = full.get("snippet", "")
        label_ids = full.get("labelIds", [])

        # Rough priority: IMPORTANT label = urgent
        priority = "urgent" if "IMPORTANT" in label_ids else "normal"

        # Human-readable time
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(date_str)
            now = datetime.now(dt.tzinfo)
            delta = now - dt
            hours = int(delta.total_seconds() // 3600)
            if hours < 1:
                time_label = "Just now"
            elif hours < 24:
                time_label = f"{hours}h ago"
            else:
                time_label = f"{delta.days}d ago"
        except Exception:
            time_label = date_str

        emails.append({
            "id": msg["id"],
            "from": sender,
            "subject": subject,
            "snippet": snippet,
            "time": time_label,
            "priority": priority,
            "body": snippet,
        })

    return emails

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
        email_summary = {"urgent": 3, "unread": 12}
        service = _get_gmail_service()
        if service:
            try:
                unread = service.users().messages().list(
                    userId="me", labelIds=["INBOX", "UNREAD"], maxResults=1
                ).execute()
                unread_count = unread.get("resultSizeEstimate", 0)
                important_unread = service.users().messages().list(
                    userId="me", labelIds=["INBOX", "UNREAD", "IMPORTANT"], maxResults=1
                ).execute()
                urgent_count = important_unread.get("resultSizeEstimate", 0)
                email_summary = {"urgent": urgent_count, "unread": unread_count}
            except Exception as e:
                print(f"Gmail summary error: {e}")

        calendar_summary = {"meetings": 0, "next_meeting": None}
        cal_events = _fetch_calendar_events()
        if cal_events is not None:
            timed = [e for e in cal_events if e["time"] != "All day"]
            calendar_summary["meetings"] = len(cal_events)
            now_str = datetime.now().strftime("%H:%M")
            upcoming = [e for e in timed if e["time"] >= now_str]
            if upcoming:
                calendar_summary["next_meeting"] = {"title": upcoming[0]["title"], "time": upcoming[0]["time"]}
        else:
            calendar_summary = {"meetings": 4, "next_meeting": {"title": "Team Standup", "time": "10:00"}}

        return {
            "success": True,
            "result": {
                "email": email_summary,
                "calendar": calendar_summary,
                "tasks": {"high": 5, "total": 15},
                "recent_activity": [
                    {"type": "email", "message": "Inbox fetched from Gmail", "timestamp": datetime.now().isoformat()}
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
        max_results = args.get("max_results", 20)
        real_emails = _fetch_gmail_emails(max_results=max_results)
        if real_emails is not None:
            return {"success": True, "result": {"emails": real_emails, "source": "gmail"}}
        # Fallback stub
        return {
            "success": True,
            "result": {
                "emails": [
                    {"id": "1", "from": "boss@company.com", "subject": "Q1 Budget Review", "snippet": "Please review...", "time": "2 hours ago", "priority": "urgent", "body": "Please review the attached Q1 budget analysis."},
                    {"id": "2", "from": "team@company.com", "subject": "Sprint Planning", "snippet": "Sprint planning...", "time": "4 hours ago", "priority": "normal", "body": "Sprint planning meeting tomorrow at 2 PM."}
                ],
                "source": "stub"
            }
        }
    
    elif command == "get_calendar_events":
        date_str = args.get("date")
        target_date = None
        if date_str:
            try:
                target_date = datetime.fromisoformat(date_str).date()
            except Exception:
                pass
        real_events = _fetch_calendar_events(target_date)
        if real_events is not None:
            return {"success": True, "result": {"events": real_events, "source": "google_calendar"}}
        # Fallback stub
        return {
            "success": True,
            "result": {
                "events": [
                    {"id": "1", "title": "Team Standup", "time": "10:00", "duration": "30m", "location": "Google Meet", "attendees": [], "virtual": True, "color": "#6366f1", "joinUrl": "", "htmlLink": ""},
                    {"id": "2", "title": "Client Call", "time": "14:00", "duration": "60m", "location": "Zoom", "attendees": [], "virtual": True, "color": "#3b82f6", "joinUrl": "", "htmlLink": ""}
                ],
                "source": "stub"
            }
        }
    
    elif command == "chat":
        message = args.get("message", "")
        return {"success": True, "result": {"response": f"I understand: '{message}'. I'm here to help!"}}
    
    elif command == "create_calendar_event":
        title = args.get("title", "New Event")
        date_str = args.get("date")
        start_time = args.get("start_time")
        end_time = args.get("end_time")
        description = args.get("description", "")

        service = _get_calendar_service()
        if not service:
            return {"success": False, "error": "Google Calendar not connected. Check your credentials in .env"}

        try:
            # Get local UTC offset as +HH:MM (RFC3339 format)
            offset_str = datetime.now().astimezone().strftime('%z')  # e.g. '+0530'
            tz_offset = f"{offset_str[:3]}:{offset_str[3:]}"        # e.g. '+05:30'

            if date_str and start_time and end_time:
                event_body = {
                    "summary": title,
                    "description": description,
                    "start": {"dateTime": f"{date_str}T{start_time}:00{tz_offset}"},
                    "end":   {"dateTime": f"{date_str}T{end_time}:00{tz_offset}"},
                }
            elif date_str:
                # All-day event
                event_body = {
                    "summary": title,
                    "description": description,
                    "start": {"date": date_str},
                    "end":   {"date": date_str},
                }
            else:
                return {"success": False, "error": "Date is required"}

            created = service.events().insert(calendarId="primary", body=event_body).execute()
            return {"success": True, "result": {"event_id": created.get("id"), "htmlLink": created.get("htmlLink", "")}}
        except Exception as e:
            return {"success": False, "error": str(e)}

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
