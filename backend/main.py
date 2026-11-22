"""StudyLab API. `uvicorn backend.main:app --port 8000` from the repo root."""
from __future__ import annotations

import asyncio
import json

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import agents
from .lanes import describe

app = FastAPI(title="StudyLab")

AGENTS = ["planner", "researcher", "explainer", "quiz", "diagrammer"]


@app.get("/api/health")
def health():
    try:
        return {"ok": True, "lane": describe()}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def pipeline(topic: str, emit):
    async def run(name, coro_fn):
        await emit({"type": "start", "agent": name})
        try:
            result = await coro_fn()
        except Exception as exc:
            await emit({"type": "error", "agent": name, "text": f"{type(exc).__name__}: {exc}"})
            return None
        await emit({"type": "done", "agent": name, "output": result})
        return result

    plan = await run("planner", lambda: agents.planner(topic, emit))
    if not plan:
        return
    research = await run("researcher", lambda: agents.researcher(topic, plan, emit))
    if not research:
        return
    await asyncio.gather(
        run("explainer", lambda: agents.explainer(topic, plan, research, emit)),
        run("quiz", lambda: agents.quiz_master(topic, research, emit)),
        run("diagrammer", lambda: agents.diagrammer(topic, plan, research, emit)),
    )


@app.get("/api/run")
async def run(topic: str):
    queue: asyncio.Queue = asyncio.Queue()

    async def emit(ev: dict):
        await queue.put(ev)

    async def driver():
        try:
            await pipeline(topic.strip(), emit)
        finally:
            await queue.put({"type": "finished"})

    task = asyncio.create_task(driver())

    async def stream():
        try:
            while True:
                ev = await queue.get()
                yield sse(ev)
                if ev["type"] == "finished":
                    break
        finally:
            task.cancel()

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class Repair(BaseModel):
    code: str
    error: str


@app.post("/api/diagram/repair")
async def repair(body: Repair):
    return {"code": await agents.repair_diagram(body.code, body.error)}
