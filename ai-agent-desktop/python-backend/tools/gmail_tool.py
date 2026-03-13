from tools.base_tool import BaseTool, ToolResult
from observability.logger import get_logger
from datetime import datetime

_logger = get_logger("gmail_tool")


class GmailTool(BaseTool):
    """Wraps the existing Gmail service for inbox operations."""

    def __init__(self, get_service_fn):
        # Pass the lazy-loader function so the tool doesn't force auth at import
        self._get_service = get_service_fn

    @property
    def name(self) -> str:
        return "gmail"

    @property
    def description(self) -> str:
        return "Gmail API — fetch inbox, read emails, search threads, get counts, create drafts"

    async def execute(self, action: str, **kwargs) -> ToolResult:
        handlers = {
            "fetch_inbox": self._fetch_inbox,
            "get_email": self._get_email,
            "search": self._search,
            "get_counts": self._get_counts,
            "create_draft": self._create_draft,
            "list_drafts": self._list_drafts,
            "get_draft": self._get_draft,
            "update_draft": self._update_draft,
            "send_draft": self._send_draft,
            "delete_draft": self._delete_draft,
        }
        handler = handlers.get(action)
        if not handler:
            return ToolResult(success=False, error=f"Unknown Gmail action: {action}")
        try:
            return await handler(**kwargs)
        except Exception as e:
            _logger.error(f"GmailTool.{action} error: {e}")
            return ToolResult(success=False, error=str(e))

    async def _fetch_inbox(self, max_results: int = 20, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=True, data=self._stub_emails(), error=None)

        results = service.users().messages().list(
            userId="me", labelIds=["INBOX"], maxResults=max_results
        ).execute()

        emails = []
        for msg in results.get("messages", []):
            full = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            ).execute()
            headers = {h["name"].lower(): h["value"] for h in full.get("payload", {}).get("headers", [])}
            label_ids = full.get("labelIds", [])

            time_label = self._humanize_date(headers.get("date", ""))
            emails.append({
                "id": msg["id"],
                "from": headers.get("from", ""),
                "subject": headers.get("subject", "(no subject)"),
                "snippet": full.get("snippet", ""),
                "time": time_label,
                "priority": "urgent" if "IMPORTANT" in label_ids else "normal",
                "unread": "UNREAD" in label_ids,
                "body": full.get("snippet", ""),
            })
        return ToolResult(success=True, data=emails)

    async def _get_email(self, email_id: str, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        full = service.users().messages().get(
            userId="me", id=email_id, format="full"
        ).execute()
        return ToolResult(success=True, data=full)

    async def _search(self, query: str, max_results: int = 10, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=True, data=[])
        results = service.users().messages().list(
            userId="me", q=query, maxResults=max_results
        ).execute()
        return ToolResult(success=True, data=results.get("messages", []))

    async def _get_counts(self, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=True, data={"unread": 0, "urgent": 0})
        unread = service.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD"], maxResults=1
        ).execute()
        urgent = service.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD", "IMPORTANT"], maxResults=1
        ).execute()
        return ToolResult(success=True, data={
            "unread": unread.get("resultSizeEstimate", 0),
            "urgent": urgent.get("resultSizeEstimate", 0),
        })

    async def _create_draft(self, to: str = "", subject: str = "", body: str = "", **_) -> ToolResult:
        if not to or "@" not in to:
            return ToolResult(
                success=False,
                error=f"Invalid recipient '{to}' — a full email address is required (e.g. name@example.com)",
            )
        service = self._get_service()
        if service is None:
            return ToolResult(
                success=False,
                error="Gmail not connected — re-authenticate with get_refresh_token.py to enable drafts",
            )
        import base64
        from email.mime.text import MIMEText
        try:
            mime = MIMEText(body)
            mime["to"] = to
            mime["subject"] = subject
            raw = base64.urlsafe_b64encode(mime.as_bytes()).decode()
            draft = service.users().drafts().create(
                userId="me", body={"message": {"raw": raw}}
            ).execute()
            return ToolResult(success=True, data={"draft_id": draft.get("id"), "to": to, "subject": subject})
        except Exception as e:
            # Likely missing gmail.compose scope — give a clear message
            if "insufficientPermissions" in str(e) or "403" in str(e):
                return ToolResult(
                    success=False,
                    error="Missing gmail.compose scope — run get_refresh_token.py to re-authenticate, then update GOOGLE_REFRESH_TOKEN in .env",
                )
            raise

    async def _list_drafts(self, max_results: int = 20, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        result = service.users().drafts().list(userId="me", maxResults=max_results).execute()
        drafts = []
        for d in result.get("drafts", []):
            full = service.users().drafts().get(
                userId="me", id=d["id"], format="metadata"
            ).execute()
            msg = full.get("message", {})
            headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
            drafts.append({
                "id": d["id"],
                "to": headers.get("to", ""),
                "subject": headers.get("subject", "(no subject)"),
                "snippet": msg.get("snippet", ""),
            })
        return ToolResult(success=True, data=drafts)

    async def _get_draft(self, draft_id: str, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        full = service.users().drafts().get(userId="me", id=draft_id, format="full").execute()
        msg = full.get("message", {})
        payload = msg.get("payload", {})
        headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
        body = self._decode_body(payload)
        return ToolResult(success=True, data={
            "id": draft_id,
            "to": headers.get("to", ""),
            "subject": headers.get("subject", ""),
            "body": body,
        })

    async def _update_draft(self, draft_id: str, to: str = "", subject: str = "", body: str = "", **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        import base64
        from email.mime.text import MIMEText
        mime = MIMEText(body)
        mime["to"] = to
        mime["subject"] = subject
        raw = base64.urlsafe_b64encode(mime.as_bytes()).decode()
        service.users().drafts().update(
            userId="me", id=draft_id,
            body={"message": {"raw": raw}}
        ).execute()
        return ToolResult(success=True, data={"id": draft_id, "to": to, "subject": subject})

    async def _send_draft(self, draft_id: str, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        try:
            sent = service.users().drafts().send(
                userId="me", body={"id": draft_id}
            ).execute()
            return ToolResult(success=True, data={"message_id": sent.get("id")})
        except Exception as e:
            if "insufficientPermissions" in str(e) or "403" in str(e):
                return ToolResult(success=False, error="Missing gmail.compose scope — re-authenticate via get_refresh_token.py")
            raise

    async def _delete_draft(self, draft_id: str, **_) -> ToolResult:
        service = self._get_service()
        if service is None:
            return ToolResult(success=False, error="Gmail not connected")
        service.users().drafts().delete(userId="me", id=draft_id).execute()
        return ToolResult(success=True, data={"deleted": draft_id})

    def _decode_body(self, payload: dict) -> str:
        """Recursively extract plain text body from a Gmail message payload."""
        import base64
        mime_type = payload.get("mimeType", "")
        if mime_type == "text/plain":
            data = payload.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            return ""
        for part in payload.get("parts", []):
            result = self._decode_body(part)
            if result:
                return result
        return ""

    def _humanize_date(self, date_str: str) -> str:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(date_str)
            now = datetime.now(dt.tzinfo)
            delta = now - dt
            hours = int(delta.total_seconds() // 3600)
            if hours < 1:
                return "Just now"
            if hours < 24:
                return f"{hours}h ago"
            return f"{delta.days}d ago"
        except Exception:
            return date_str

    def _stub_emails(self) -> list:
        return [
            {"id": "stub1", "from": "boss@company.com", "subject": "Q1 Budget Review",
             "snippet": "Please review the attached Q1 budget analysis.", "time": "2h ago",
             "priority": "urgent", "unread": True, "body": "Please review the attached Q1 budget."},
            {"id": "stub2", "from": "team@company.com", "subject": "Sprint Planning",
             "snippet": "Sprint planning meeting tomorrow at 2 PM.", "time": "4h ago",
             "priority": "normal", "unread": False, "body": "Sprint planning meeting tomorrow at 2 PM."},
        ]
