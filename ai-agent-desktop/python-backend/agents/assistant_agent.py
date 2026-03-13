import asyncio
import json
from datetime import date as _date
from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput
from memory.conversation_memory import ConversationMemory


class AssistantAgent(BaseAgent):
    """
    User-facing conversational agent.
    Interprets free-form user commands, plans multi-agent workflows,
    and compiles results into natural language responses.
    Never calls other agents directly — uses the orchestrator.
    """

    def __init__(self, tool_registry, memory, event_bus, orchestrator,
                 conv_memory: ConversationMemory):
        super().__init__(tool_registry, memory, event_bus)
        self._orchestrator = orchestrator
        self._conv_memory = conv_memory
        # Pending destructive action awaiting user confirmation.
        # Shape: {"action": str, "params": dict, "summary": str}
        self._pending_action: dict | None = None

    @property
    def name(self) -> str:
        return "assistant_agent"

    @property
    def description(self) -> str:
        return "User-facing AI chief of staff — chat, planning, workflow coordination"

    @property
    def capabilities(self) -> list[str]:
        return [
            "user_chat", "workflow_planning", "compile_briefing",
            "compile_daily_summary", "compile_morning_briefing",
        ]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "compile_briefing": self._compile_briefing,
            "compile_daily_summary": self._compile_daily_summary,
            "compile_morning_briefing": self._compile_morning_briefing,
            "user_chat": self._user_chat,
        }
        handler = dispatch.get(input.intent, self._user_chat)
        return await handler(input)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _get_ids(self, input: AgentInput) -> tuple[str, str]:
        """Return (user_id, conversation_id) from the input."""
        user_id = input.user_id or "default"
        conversation_id = input.parameters.get("conversation_id", "default")
        return user_id, conversation_id

    async def _save_turn(
        self,
        input: AgentInput,
        response_text: str,
        metadata: dict | None = None,
    ) -> None:
        """Persist the completed turn to conversation memory (fire-and-forget errors)."""
        try:
            user_id, conversation_id = self._get_ids(input)
            message = input.parameters.get("message", input.intent)
            await self._conv_memory.add_turn(
                user_id=user_id,
                conversation_id=conversation_id,
                user_msg=message,
                assistant_msg=response_text,
                metadata=metadata or {},
            )
        except Exception:
            pass  # Memory failures must never crash the chat

    async def _build_context(self, input: AgentInput) -> str:
        """Retrieve combined recent history + semantic memory for this turn."""
        try:
            user_id, conversation_id = self._get_ids(input)
            message = input.parameters.get("message", input.intent)
            return await self._conv_memory.build_context(user_id, conversation_id, message)
        except Exception:
            return ""

    # ── Main chat handler ──────────────────────────────────────────────────────

    async def _user_chat(self, input: AgentInput) -> AgentOutput:
        """
        Parse the user's free-form message into a structured action using Claude,
        then execute it — dispatch to specialist agents or answer directly.
        """
        claude = self.get_tool("claude")
        message = input.parameters.get("message", input.intent)
        today_str = _date.today().isoformat()

        # ── Step 0: confirmation / cancellation for a pending destructive action ──
        if self._pending_action:
            normalised = message.strip().lower()
            confirmed = normalised in {
                "yes", "y", "confirm", "proceed", "do it",
                "go ahead", "ok", "okay", "sure", "yep", "yup",
            }
            cancelled = normalised in {
                "no", "n", "cancel", "stop", "abort",
                "nope", "nah", "don't", "dont",
            }
            if confirmed:
                pending = self._pending_action
                self._pending_action = None
                return await self._execute_confirmed_action(pending, input)
            elif cancelled:
                self._pending_action = None
                response_text = "Cancelled. No changes were made."
                await self._save_turn(input, response_text, {"action": "cancel"})
                return AgentOutput(
                    task_id=input.task_id, agent=self.name, success=True,
                    result={"response": response_text, "message": message},
                )
            # Ambiguous — clear pending and fall through to normal routing
            self._pending_action = None

        # ── Step 1: retrieve conversation memory ──────────────────────────────
        context_block = await self._build_context(input)
        context_suffix = f"\n\n{context_block}" if context_block else ""

        # ── Step 2: classify intent ───────────────────────────────────────────
        parse_result = await claude.execute(
            system=(
                "You are an intent router for a personal AI chief of staff. "
                "Classify the user request and return ONLY a valid JSON object — no markdown, no explanation:\n"
                "{\n"
                '  "action": "answer" | "draft_email" | "workflow" | "search" | "create_task" | "create_event" | "delete_event" | "calendar",\n'
                '  "workflow": null | "morning_routine" | "handle_inbox" | "daily_summary" | "prepare_for_tomorrow",\n'
                '  "to": null | "recipient name or email",\n'
                '  "subject": null | "email subject",\n'
                '  "body": null | "email body text",\n'
                '  "query": null | "search query or task title",\n'
                '  "event_title": null | "calendar event title",\n'
                '  "event_date": null | "YYYY-MM-DD date of the event",\n'
                '  "event_start_time": null | "HH:MM 24h start time",\n'
                '  "event_end_time": null | "HH:MM 24h end time",\n'
                '  "event_description": null | "event description or notes",\n'
                '  "event_keywords": null | "keywords to identify the event to delete",\n'
                '  "direct_answer": null | "short direct answer when action is answer"\n'
                "}\n"
                f"Today's date is {today_str}. Resolve relative dates like 'tomorrow', 'next Monday' to YYYY-MM-DD.\n"
                "Use the conversation history below to resolve references like 'it', 'that', 'the same one', etc.\n"
                "Examples:\n"
                "- 'Email john@company.com about the meeting tomorrow' → {\"action\":\"draft_email\",\"to\":\"john@company.com\",\"subject\":\"Meeting tomorrow\",\"body\":\"...\", ...}\n"
                "- 'Email John about the meeting' → {\"action\":\"draft_email\",\"to\":\"John\",\"subject\":\"Meeting\",\"body\":\"...\", ...}\n"
                "- 'Prepare me for tomorrow' → {\"action\":\"workflow\",\"workflow\":\"prepare_for_tomorrow\", ...}\n"
                "- 'Search for Python async tips' → {\"action\":\"search\",\"query\":\"Python async tips\", ...}\n"
                "- 'Add a task to review the Q1 report' → {\"action\":\"create_task\",\"query\":\"Review Q1 report\", ...}\n"
                "- 'Schedule a team sync tomorrow at 2pm to 3pm' → {\"action\":\"create_event\",\"event_title\":\"Team Sync\",\"event_date\":\"YYYY-MM-DD\",\"event_start_time\":\"14:00\",\"event_end_time\":\"15:00\", ...}\n"
                "- 'Delete the standup meeting tomorrow' → {\"action\":\"delete_event\",\"event_keywords\":\"standup\",\"event_date\":\"YYYY-MM-DD\", ...}\n"
                "- 'Remove my 2pm call on Friday' → {\"action\":\"delete_event\",\"event_keywords\":\"2pm call\",\"event_date\":\"YYYY-MM-DD\", ...}\n"
                "- 'What meetings do I have today?' → {\"action\":\"calendar\", ...}\n"
                "- 'What is the capital of France?' → {\"action\":\"answer\",\"direct_answer\":\"Paris.\", ...}"
                + context_suffix
            ),
            prompt=message,
            as_json=True,
        )

        # Fallback: plain conversational response if JSON classification failed
        if not parse_result.success or not isinstance(parse_result.data, dict):
            conv = await claude.execute(
                system=(
                    "You are Fabric AI, a personal AI chief of staff. Be concise and helpful."
                    + context_suffix
                ),
                prompt=message,
            )
            response_text = conv.data or "I'm here — could you rephrase that?"
            await self._save_turn(input, response_text, {"action": "fallback"})
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=True,
                result={"response": response_text, "message": message},
            )

        action = parse_result.data.get("action", "answer")
        response_text = ""

        # ── Step 3: execute the classified action ─────────────────────────────

        if action == "draft_email":
            to = parse_result.data.get("to") or ""
            subject = parse_result.data.get("subject") or ""
            body = parse_result.data.get("body") or ""

            if to and "@" not in to:
                response_text = (
                    f"I need {to}'s full email address to create this draft. "
                    "What is their email address?"
                )
            elif not to:
                response_text = "Who should I send this to? Please provide their email address."
            else:
                await self._orchestrator.dispatch(
                    intent="draft_reply",
                    parameters={"to": to, "subject": subject, "body": body},
                    agent_name="email_agent",
                    workflow_id=input.workflow_id,
                )
                response_text = (
                    f"Drafting an email to {to} — "
                    f"subject: '{subject or '(untitled)'}'. Email Agent is on it, check your Gmail drafts."
                )

        elif action == "workflow":
            workflow = parse_result.data.get("workflow")
            labels = {
                "morning_routine": "Morning Briefing",
                "handle_inbox": "Handle Inbox",
                "daily_summary": "Daily Summary",
                "prepare_for_tomorrow": "Prepare for Tomorrow",
            }
            if workflow and workflow in labels:
                asyncio.create_task(self._orchestrator.run_named_workflow(workflow))
                response_text = (
                    f"Starting {labels[workflow]} — your agents are working on it. "
                    "Watch the event feed for progress."
                )
            else:
                response_text = (
                    "I'm not sure which workflow you mean. "
                    "Options: Morning Briefing, Handle Inbox, Daily Summary, Prepare for Tomorrow."
                )

        elif action == "search":
            query = parse_result.data.get("query") or message
            await self._orchestrator.dispatch(
                intent="web_search",
                parameters={"query": query},
                agent_name="research_agent",
                workflow_id=input.workflow_id,
            )
            response_text = (
                f"Searching for '{query}'. Research Agent is on it — "
                "results will appear in the event feed."
            )

        elif action == "create_task":
            title = parse_result.data.get("query") or message
            await self._orchestrator.dispatch(
                intent="create_task",
                parameters={"title": title},
                agent_name="task_agent",
                workflow_id=input.workflow_id,
            )
            response_text = f"Creating task: '{title}'. Task Agent has it."

        elif action == "create_event":
            d = parse_result.data
            title = d.get("event_title") or "New Event"
            event_date = d.get("event_date") or today_str
            start_time = d.get("event_start_time")
            end_time = d.get("event_end_time")
            description = d.get("event_description") or ""
            await self._orchestrator.dispatch(
                intent="create_event",
                parameters={
                    "title": title,
                    "date": event_date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "description": description,
                },
                agent_name="calendar_agent",
                workflow_id=input.workflow_id,
            )
            time_str = f" at {start_time}" if start_time else ""
            response_text = (
                f"Adding '{title}' to your calendar on {event_date}{time_str}. "
                "Calendar Agent is on it."
            )

        elif action == "delete_event":
            d = parse_result.data
            keywords = (d.get("event_keywords") or "").lower().strip()
            event_date = d.get("event_date") or today_str

            cal = self.get_tool("calendar")
            list_result = await cal.execute(action="list_events", date=event_date)
            events = list_result.data or [] if list_result.success else []

            if keywords:
                kw_words = keywords.split()
                matches = [
                    e for e in events
                    if any(w in e.get("title", "").lower() for w in kw_words)
                ]
            else:
                matches = events

            if not matches:
                response_text = (
                    f"I couldn't find any event matching '{keywords or 'your request'}' on {event_date}. "
                    "Could you be more specific about the event name or date?"
                )
            elif len(matches) == 1:
                evt = matches[0]
                time_info = (
                    f" at {evt['time']}"
                    if evt.get("time") and evt["time"] != "All day"
                    else " (all day)"
                )
                duration = (
                    f" ({evt['duration']})"
                    if evt.get("duration") and evt["duration"] != "All day"
                    else ""
                )
                location = f"\nLocation: {evt['location']}" if evt.get("location") else ""
                self._pending_action = {
                    "action": "delete_event",
                    "params": {"event_id": evt["id"], "event_title": evt["title"]},
                    "summary": f"Delete **'{evt['title']}'** on {event_date}{time_info}{duration}",
                }
                response_text = (
                    f"I found this event on your calendar:\n\n"
                    f"**{evt['title']}** — {event_date}{time_info}{duration}{location}\n\n"
                    f"Here's what I'll do:\n"
                    f"• Delete **'{evt['title']}'** from your calendar permanently\n\n"
                    f"Reply **yes** to confirm, or **no** to cancel."
                )
            else:
                lines = "\n".join(
                    f"• **{e['title']}** at {e.get('time', 'All day')}" for e in matches[:5]
                )
                response_text = (
                    f"I found {len(matches)} events on {event_date} matching '{keywords}':\n\n"
                    f"{lines}\n\n"
                    "Could you be more specific about which one to delete?"
                )

        elif action == "calendar":
            await self._orchestrator.dispatch(
                intent="get_today_meetings",
                parameters={},
                agent_name="calendar_agent",
                workflow_id=input.workflow_id,
            )
            response_text = "Fetching your schedule. Calendar Agent is checking your meetings."

        else:  # "answer"
            direct = parse_result.data.get("direct_answer")
            if direct:
                response_text = direct
            else:
                conv = await claude.execute(
                    system=(
                        "You are Fabric AI, a personal AI chief of staff. "
                        "Answer concisely and helpfully."
                        + context_suffix
                    ),
                    prompt=message,
                )
                response_text = conv.data or "I'm here to help — could you elaborate?"

        # ── Step 4: persist this turn to memory ───────────────────────────────
        await self._save_turn(input, response_text, {"action": action})

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"response": response_text, "message": message},
        )

    async def _execute_confirmed_action(
        self, pending: dict, input: AgentInput
    ) -> AgentOutput:
        """Execute a staged destructive action after the user confirms."""
        action = pending["action"]
        params = pending["params"]

        if action == "delete_event":
            await self._orchestrator.dispatch(
                intent="delete_event",
                parameters=params,
                agent_name="calendar_agent",
                workflow_id=input.workflow_id,
            )
            response_text = f"Done — **'{params['event_title']}'** has been deleted from your calendar."
        else:
            response_text = f"Action '{action}' confirmed but no executor found."

        await self._save_turn(input, response_text, {"action": f"confirmed_{action}"})
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"response": response_text, "message": input.parameters.get("message", "")},
        )

    # ── Workflow compilers ─────────────────────────────────────────────────────

    async def _compile_briefing(self, input: AgentInput) -> AgentOutput:
        """Synthesize all prior workflow step results into a meeting prep brief."""
        claude = self.get_tool("claude")

        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])
        participants = (input.context.get("research_agent") or {}).get("participants", [])
        threads = (input.context.get("email_agent") or {}).get("related_threads", [])
        tasks = (input.context.get("task_agent") or {}).get("relevant_tasks", [])

        brief = await claude.execute(
            system=(
                "You are an executive assistant creating a concise meeting preparation brief. "
                "Format with clear sections. Be actionable and scannable."
            ),
            prompt=(
                f"Tomorrow's meetings: {json.dumps(meetings, default=str)}\n\n"
                f"Participant backgrounds: {json.dumps(participants, default=str)}\n\n"
                f"Related email threads: {threads}\n\n"
                f"Relevant tasks: {tasks}\n\n"
                "Create a professional meeting prep brief."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=brief.success,
            result={"briefing": brief.data, "meetings_count": len(meetings)},
        )

    async def _compile_daily_summary(self, input: AgentInput) -> AgentOutput:
        claude = self.get_tool("claude")

        email_data = input.context.get("email_agent") or {}
        calendar_data = input.context.get("calendar_agent") or {}
        task_data = input.context.get("task_agent") or {}

        summary = await claude.execute(
            system=(
                "You are an executive assistant. Create a concise daily summary. "
                "Use bullet points and be actionable."
            ),
            prompt=(
                f"Email summary: {email_data.get('summary', 'No data')}\n\n"
                f"Today's meetings: {calendar_data.get('meetings', [])}\n\n"
                f"Overdue tasks: {task_data.get('overdue_tasks', [])}\n\n"
                "Create a 5-bullet daily summary with priorities."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=summary.success,
            result={"summary": summary.data},
        )

    async def _compile_morning_briefing(self, input: AgentInput) -> AgentOutput:
        claude = self.get_tool("claude")

        from datetime import datetime
        calendar_data = input.context.get("calendar_agent") or {}
        email_data = input.context.get("email_agent") or {}
        task_data = input.context.get("task_agent") or {}

        greeting = await claude.execute(
            system=(
                "You are Fabric AI, an upbeat and helpful personal AI chief of staff. "
                "Create an energizing morning briefing. Be friendly and concise."
            ),
            prompt=(
                f"Good morning! Today is {datetime.now().strftime('%A, %B %d')}.\n\n"
                f"Today's meetings ({len(calendar_data.get('meetings', []))}): {calendar_data.get('meetings', [])}\n\n"
                f"Email inbox: {email_data.get('summary', 'No email data')}\n\n"
                f"High priority tasks: {task_data.get('high_priority_tasks', [])}\n\n"
                "Write a concise morning briefing covering: schedule, inbox status, top priorities."
            ),
        )

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=greeting.success,
            result={"briefing": greeting.data},
        )
