from agents.base_agent import BaseAgent
from models.messages import AgentInput, AgentOutput, AgentAction
from models.events import Event, EventType


class TaskAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "task_agent"

    @property
    def description(self) -> str:
        return "Manages tasks: create, prioritize, surface deadlines, follow-ups from emails"

    @property
    def capabilities(self) -> list[str]:
        return [
            "create_task", "list_tasks", "surface_overdue_tasks",
            "surface_high_priority_tasks", "create_followup_tasks",
            "surface_relevant_tasks", "reprioritize",
        ]

    async def execute(self, input: AgentInput) -> AgentOutput:
        dispatch = {
            "create_task": self._create_task,
            "list_tasks": self._list_tasks,
            "surface_overdue_tasks": self._surface_overdue,
            "surface_high_priority_tasks": self._surface_high_priority,
            "surface_relevant_tasks": self._surface_relevant,
            "create_followup_tasks": self._create_followup_tasks,
            "toggle_task": self._toggle_task,
            "delete_task": self._delete_task,
        }
        handler = dispatch.get(input.intent)
        if not handler:
            return AgentOutput(
                task_id=input.task_id, agent=self.name, success=False,
                error=f"Unknown intent: {input.intent}",
            )
        return await handler(input)

    async def _create_task(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        p = input.parameters
        result = await db.execute(
            action="create",
            title=p.get("title", "Untitled Task"),
            priority=p.get("priority", "medium"),
            description=p.get("description", ""),
            due_date=p.get("due_date"),
            tags=p.get("tags", []),
        )
        if result.success:
            await self._event_bus.publish(Event(
                type=EventType.TASK_CREATED,
                payload=result.data,
                source=self.name,
                workflow_id=input.workflow_id,
            ))
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=result.success,
            result=result.data, error=result.error,
            events_emitted=[EventType.TASK_CREATED] if result.success else [],
        )

    async def _list_tasks(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        status = input.parameters.get("status")
        result = await db.execute(action="list", status=status)
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=result.success,
            result={"tasks": result.data}, error=result.error,
        )

    async def _surface_overdue(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        result = await db.execute(action="list_overdue")
        tasks = result.data or []

        if tasks:
            await self._event_bus.publish(Event(
                type=EventType.TASK_OVERDUE,
                payload={"count": len(tasks), "tasks": tasks[:5]},
                source=self.name,
            ))

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"overdue_tasks": tasks, "count": len(tasks)},
        )

    async def _surface_high_priority(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        result = await db.execute(action="list_high_priority")
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"high_priority_tasks": result.data or [], "count": len(result.data or [])},
        )

    async def _surface_relevant(self, input: AgentInput) -> AgentOutput:
        """Surface tasks relevant to tomorrow's meetings (from workflow context)."""
        db = self.get_tool("task_db")
        meetings = (input.context.get("calendar_agent") or {}).get("meetings", [])
        result = await db.execute(action="list", status="pending")
        tasks = result.data or []

        # Simple relevance: tasks whose title keywords match meeting titles
        relevant = []
        meeting_titles = [m.get("title", "").lower() for m in meetings]
        for task in tasks:
            title_lower = task.get("title", "").lower()
            if any(word in title_lower for mt in meeting_titles for word in mt.split() if len(word) > 3):
                relevant.append(task)

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"relevant_tasks": relevant or tasks[:5]},
        )

    async def _create_followup_tasks(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        emails = input.parameters.get("emails", [])
        # Also check context
        if not emails:
            triaged = (input.context.get("email_agent") or {}).get("triaged", [])
            if isinstance(triaged, list):
                emails = [e for e in triaged if isinstance(e, dict) and e.get("urgency") == "urgent"]

        created = []
        for email in emails[:10]:  # cap to avoid spamming tasks
            subject = email.get("subject", "Follow up on email")
            sender = email.get("from", "")
            result = await db.execute(
                action="create",
                title=f"Follow up: {subject[:60]}",
                priority="high",
                description=f"Follow up on email from {sender}: {email.get('snippet', '')}",
                tags=["email-followup"],
            )
            if result.success:
                created.append(result.data)

        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=True,
            result={"tasks_created": created, "count": len(created)},
        )

    async def _toggle_task(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        task_id = input.parameters.get("task_id")
        current = await db.execute(action="get", task_id=task_id)
        if not current.success or not current.data:
            return AgentOutput(task_id=input.task_id, agent=self.name,
                               success=False, error="Task not found")
        new_status = "completed" if current.data["status"] == "pending" else "pending"
        result = await db.execute(action="update", task_id=task_id, status=new_status)
        if new_status == "completed":
            await self._event_bus.publish(Event(
                type=EventType.TASK_COMPLETED,
                payload={"task_id": task_id},
                source=self.name,
            ))
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=result.success,
            result={"task_id": task_id, "status": new_status},
        )

    async def _delete_task(self, input: AgentInput) -> AgentOutput:
        db = self.get_tool("task_db")
        task_id = input.parameters.get("task_id")
        result = await db.execute(action="delete", task_id=task_id)
        return AgentOutput(
            task_id=input.task_id, agent=self.name, success=result.success,
            result=result.data, error=result.error,
        )
