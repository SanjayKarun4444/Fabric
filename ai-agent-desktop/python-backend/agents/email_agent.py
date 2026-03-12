from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput, AgentAction
from models.events import Event, EventType


class EmailAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "email_agent"

    @property
    def description(self) -> str:
        return "Manages Gmail: inbox triage, draft replies, urgency detection, summaries"

    @property
    def capabilities(self) -> list[str]:
        return [
            "email_triage", "email_draft", "inbox_summary",
            "urgency_detection", "find_related_threads",
        ]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "triage_inbox": self._triage_inbox,
            "draft_reply": self._draft_reply,
            "inbox_summary": self._inbox_summary,
            "find_related_threads": self._find_related_threads,
        }
        handler = dispatch.get(input.intent)
        if not handler:
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=False,
                error=f"Unknown intent: {input.intent}",
            )
        return await handler(input)

    async def _triage_inbox(self, input: AgentInput) -> AgentOutput:
        gmail = self.get_tool("gmail")
        claude = self.get_tool("claude")
        actions = []

        fetch = await gmail.execute(action="fetch_inbox", max_results=20)
        actions.append(AgentAction(type="tool_call", tool="gmail",
                                   parameters={"action": "fetch_inbox"}, success=fetch.success))
        if not fetch.success:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error=fetch.error, actions_taken=actions)

        emails = fetch.data
        triage = await claude.execute(
            system=(
                "You are an executive assistant. Given a list of emails, classify each one. "
                "Return a JSON array with objects: {id, subject, from, urgency (urgent/normal/low), "
                "category (action_required/fyi/newsletter/meeting/other), action_needed (bool), summary}. "
                "Be concise. Return only the JSON array."
            ),
            prompt=f"Triage these emails:\n{emails}",
            as_json=True,
        )
        actions.append(AgentAction(type="tool_call", tool="claude",
                                   parameters={"action": "triage"}, success=triage.success))

        triaged = triage.data if triage.success else emails

        # Store in workflow context for downstream agents
        await self.memory.set_context(input.workflow_id or input.task_id, "triaged_emails", triaged)

        await self._event_bus.publish(Event(
            type=EventType.INBOX_TRIAGED,
            payload={"triaged": triaged if isinstance(triaged, list) else []},
            source=self.name,
            workflow_id=input.workflow_id,
        ))

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            actions_taken=actions, result=triaged,
            events_emitted=[EventType.INBOX_TRIAGED],
        )

    async def _draft_reply(self, input: AgentInput) -> AgentOutput:
        """
        Two modes:
        - Compose new: parameters has `to`, `subject`, `body` (dispatched by AssistantAgent)
        - Reply to existing: parameters has `email_id` (direct call from UI)
        """
        gmail = self.get_tool("gmail")
        claude = self.get_tool("claude")
        params = input.parameters
        tone = params.get("tone", "professional")

        # ── Compose new email ─────────────────────────────────────────────────
        if params.get("to"):
            to = params["to"]
            subject = params.get("subject", "")
            body = params.get("body", "")

            # If body is sparse, enrich it with Claude
            if not body or len(body) < 20:
                enriched = await claude.execute(
                    system=f"You are a professional executive assistant. Tone: {tone}.",
                    prompt=(
                        f"Write a concise, professional email.\n"
                        f"To: {to}\nSubject: {subject}\n"
                        "Keep it brief (2-4 sentences). Return only the email body, no greeting/sign-off."
                    ),
                )
                body = enriched.data or body

            draft_result = await gmail.execute(
                action="create_draft", to=to, subject=subject, body=body
            )
            if draft_result.success:
                return AgentOutput(
                    task_id=input.task_id, agent=self.name, success=True,
                    result={"draft_id": draft_result.data.get("draft_id"), "to": to,
                            "subject": subject, "body": body, "status": "draft_created"},
                )
            else:
                # create_draft failed (likely missing scope) — return the body Claude wrote
                # so the user at least sees what would have been sent
                return AgentOutput(
                    task_id=input.task_id, agent=self.name, success=True,
                    result={
                        "to": to, "subject": subject, "body": body,
                        "status": "draft_preview",
                        "note": draft_result.error or "Could not save to Gmail — showing preview only",
                    },
                )

        # ── Reply to existing email ───────────────────────────────────────────
        email_id = params.get("email_id")
        if not email_id:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error="Provide either 'to' (new email) or 'email_id' (reply)")

        email = await gmail.execute(action="get_email", email_id=email_id)
        if not email.success:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error=email.error)

        draft = await claude.execute(
            system=f"You are a professional executive assistant drafting email replies. Tone: {tone}.",
            prompt=f"Draft a concise, professional reply to this email:\n{email.data}",
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=draft.success,
            result={"draft": draft.data, "email_id": email_id},
            error=draft.error,
        )

    async def _inbox_summary(self, input: AgentInput) -> AgentOutput:
        gmail = self.get_tool("gmail")
        claude = self.get_tool("claude")

        counts = await gmail.execute(action="get_counts")
        fetch = await gmail.execute(action="fetch_inbox", max_results=10)

        summary = await claude.execute(
            system="You are a concise executive assistant. Summarize the inbox briefly.",
            prompt=(
                f"Email counts: {counts.data}\n\n"
                f"Recent emails:\n{fetch.data}\n\n"
                "Give a 3-bullet summary of inbox status."
            ),
        )
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={
                "summary": summary.data,
                "counts": counts.data,
                "emails": fetch.data,
            },
        )

    async def _find_related_threads(self, input: AgentInput) -> AgentOutput:
        gmail = self.get_tool("gmail")
        # Meetings provided by CalendarAgent in prior workflow step
        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])

        threads = []
        for meeting in meetings[:5]:  # limit API calls
            title = meeting.get("title", "")
            if title and title != "(No title)":
                result = await gmail.execute(action="search", query=title, max_results=3)
                if result.success:
                    threads.extend(result.data or [])

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"related_threads": threads},
        )
