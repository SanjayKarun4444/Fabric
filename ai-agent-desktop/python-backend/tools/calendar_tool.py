from tools.base_tool import BaseTool, ToolResult
from observability.logger import get_logger
from datetime import datetime, timedelta

_logger = get_logger("calendar_tool")

_EVENT_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']
_VIRTUAL_KEYWORDS = {'zoom', 'meet', 'teams', 'webex', 'skype', 'slack', 'whereby', 'bluejeans'}


class CalendarTool(BaseTool):
    """Wraps Google Calendar service for event reading and creation."""

    def __init__(self, get_service_fn):
        self._get_service = get_service_fn

    @property
    def name(self) -> str:
        return "calendar"

    @property
    def description(self) -> str:
        return "Google Calendar API — list events, create events, delete events, detect conflicts"

    async def execute(self, action: str, **kwargs) -> ToolResult:
        handlers = {
            "list_events": self._list_events,
            "create_event": self._create_event,
            "delete_event": self._delete_event,
            "get_next_event": self._get_next_event,
        }
        handler = handlers.get(action)
        if not handler:
            return ToolResult(success=False, error=f"Unknown Calendar action: {action}")
        try:
            return await handler(**kwargs)
        except Exception as e:
            _logger.error(f"CalendarTool.{action} error: {e}")
            return ToolResult(success=False, error=str(e))

    async def _list_events(self, date: str = None, days_ahead: int = 1, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=True, data=self._stub_events())

        if date:
            target_date = datetime.fromisoformat(date).date()
        else:
            target_date = datetime.now().date()

        local_tz = datetime.now().astimezone().tzinfo
        day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=local_tz)
        day_end = day_start + timedelta(days=days_ahead)

        result = service.events().list(
            calendarId="primary",
            timeMin=day_start.isoformat(),
            timeMax=day_end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        ).execute()

        events = []
        for idx, item in enumerate(result.get("items", [])):
            events.append(self._parse_event(item, idx))
        return ToolResult(success=True, data=events)

    async def _get_next_event(self, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=True, data={"title": "Team Standup", "time": "10:00"})

        now = datetime.now().astimezone()
        result = service.events().list(
            calendarId="primary",
            timeMin=now.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=1,
        ).execute()
        items = result.get("items", [])
        if items:
            return ToolResult(success=True, data=self._parse_event(items[0], 0))
        return ToolResult(success=True, data=None)

    async def _create_event(self, title: str, date: str, end_date: str = None,
                            start_time: str = None, end_time: str = None,
                            description: str = "", **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Google Calendar not connected")

        tz_offset = datetime.now().astimezone().strftime('%z')
        tz_offset = f"{tz_offset[:3]}:{tz_offset[3:]}"
        actual_end_date = end_date or date

        if start_time and end_time:
            body = {
                "summary": title,
                "description": description,
                "start": {"dateTime": f"{date}T{start_time}:00{tz_offset}"},
                "end": {"dateTime": f"{actual_end_date}T{end_time}:00{tz_offset}"},
            }
        else:
            body = {
                "summary": title,
                "description": description,
                "start": {"date": date},
                "end": {"date": actual_end_date},
            }

        created = service.events().insert(calendarId="primary", body=body).execute()
        return ToolResult(success=True, data={
            "event_id": created.get("id"),
            "htmlLink": created.get("htmlLink", ""),
        })

    async def _delete_event(self, event_id: str, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Google Calendar not connected")
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return ToolResult(success=True, data={"deleted_event_id": event_id})

    def _parse_event(self, item: dict, idx: int) -> dict:
        start_raw = item.get("start", {})
        end_raw = item.get("end", {})

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

        is_virtual = bool(hangout_link) or bool(conference_data)
        if not is_virtual and location:
            is_virtual = any(kw in location.lower() for kw in _VIRTUAL_KEYWORDS)

        join_url = hangout_link
        if not join_url and conference_data:
            for ep in conference_data.get("entryPoints", []):
                if ep.get("entryPointType") == "video":
                    join_url = ep.get("uri", "")
                    break

        attendees = [
            a.get("displayName") or a.get("email", "")
            for a in item.get("attendees", [])
            if not a.get("self")
        ]

        return {
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
        }

    def _stub_events(self) -> list:
        return [
            {"id": "s1", "title": "Team Standup", "time": "10:00", "duration": "30m",
             "location": "Google Meet", "attendees": [], "virtual": True,
             "color": "#6366f1", "joinUrl": "", "htmlLink": ""},
            {"id": "s2", "title": "Client Call", "time": "14:00", "duration": "60m",
             "location": "Zoom", "attendees": [], "virtual": True,
             "color": "#3b82f6", "joinUrl": "", "htmlLink": ""},
        ]
