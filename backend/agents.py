"""The StudyLab agents. Each takes an `emit` callback for live events."""
from __future__ import annotations

import json
import re
from typing import Awaitable, Callable

from . import llm
from .tools import TOOL_SCHEMAS, wikipedia_page, wikipedia_search

Emit = Callable[[dict], Awaitable[None]]

MERMAID_RULES = """Mermaid rules (the diagram MUST render):
- Put EVERY node label in double quotes: A["Label text"]. Never use parentheses, brackets or quotes inside a label.
- Use simple ASCII ids (A, B, C1). One statement per line. No markdown fences, no comments.
- Allowed kinds: flowchart TD, flowchart LR, mindmap, timeline, sequenceDiagram.
- mindmap: indent with 2 spaces, plain text nodes, root like root((Topic)).
- timeline: first line `timeline`, then `title X`, then `2001 : event`."""


def clean_mermaid(code: str) -> str:
    """Models often double-escape newlines or wrap code in fences; undo that."""
    code = (code or "").replace("\\n", "\n").replace("\\t", "  ").strip()
    code = re.sub(r"^```(?:mermaid)?\s*|\s*```$", "", code).strip()
    return code


# ---------------------------------------------------------------- Planner
async def planner(topic: str, emit: Emit) -> dict:
    plan = await llm.ask_json(
        "You are a study-planning agent. Given a topic, produce a compact plan. "
        'Reply as JSON: {"title": str, "level": "beginner|intermediate|advanced", '
        '"subtopics": [3-6 short strings], "search_queries": [2-3 Wikipedia search queries]}.',
        f"Topic: {topic}")
    plan.setdefault("title", topic)
    plan["subtopics"] = plan.get("subtopics") or [topic]
    plan["search_queries"] = plan.get("search_queries") or [topic]
    return plan


# ------------------------------------------------------------- Researcher
async def researcher(topic: str, plan: dict, emit: Emit, max_steps: int = 6) -> dict:
    """Plan-act loop with Wikipedia tools. Sources come from pages actually fetched."""
    messages = [
        {"role": "system", "content":
            "You are a research agent. Use wikipedia_search and wikipedia_page to gather facts about the "
            "topic. Fetch 2-4 relevant pages, covering the subtopics. When you have enough, reply with the "
            "single word DONE."},
        {"role": "user", "content": f"Topic: {topic}\nSubtopics: {plan['subtopics']}\n"
                                    f"Suggested searches: {plan['search_queries']}"},
    ]
    pages: dict[str, dict] = {}
    bad_calls = 0
    for step in range(max_steps):
        try:
            resp = await llm.call(messages, tools=TOOL_SCHEMAS)
        except Exception as exc:
            # gpt-oss sometimes emits a malformed tool name and Groq rejects it with a 400.
            # Retry the step; after repeated failures fall through to the top-up lookup below.
            if "tool call validation" not in str(exc).lower() and "400" not in str(exc):
                raise
            bad_calls += 1
            await emit({"type": "log", "agent": "researcher", "text": "malformed tool call, retrying"})
            if bad_calls >= 3:
                break
            continue
        msg = resp.choices[0].message
        if not msg.tool_calls:
            break
        messages.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [{"id": t.id, "type": "function",
                                         "function": {"name": t.function.name,
                                                      "arguments": t.function.arguments}}
                                        for t in msg.tool_calls]})
        for t in msg.tool_calls:
            try:
                args = json.loads(t.function.arguments or "{}")
                if t.function.name == "wikipedia_search":
                    await emit({"type": "log", "agent": "researcher",
                                "text": f'search: "{args["query"]}"'})
                    result = await wikipedia_search(args["query"])
                else:
                    await emit({"type": "log", "agent": "researcher",
                                "text": f'read page: "{args["title"]}"'})
                    page = await wikipedia_page(args["title"])
                    if page["text"]:
                        pages[page["title"]] = page
                    result = {"title": page["title"], "text": page["text"][:3500],
                              **({"error": page["error"]} if "error" in page else {})}
            except Exception as exc:
                result = {"error": str(exc)}
            messages.append({"role": "tool", "tool_call_id": t.id,
                             "content": json.dumps(result)[:5000]})
    if len(pages) < 2:  # model under-fetched: top up from the plan's queries
        hits = []
        for q in [*plan["search_queries"], topic]:
            hits += await wikipedia_search(q, 1)
        for h in hits:
            if len(pages) >= 3:
                break
            if h["title"] in pages:
                continue
            await emit({"type": "log", "agent": "researcher", "text": f'read page: "{h["title"]}"'})
            p = await wikipedia_page(h["title"])
            if p["text"]:
                pages[p["title"]] = p
    material = "\n\n".join(f"## {p['title']}\n{p['text']}" for p in pages.values())
    notes = await llm.ask_json(
        "You are a research agent. Distil the source material into study notes. "
        'Reply as JSON: {"key_concepts": [{"term": str, "definition": str}] (5-8 items), '
        '"notes": "markdown notes, grouped by subtopic, only facts supported by the sources"}.',
        f"Topic: {topic}\n\nSOURCES:\n{material[:14000]}")
    notes["sources"] = [{"title": p["title"], "url": p["url"]} for p in pages.values()]
    return notes


def _notes_blob(research: dict) -> str:
    concepts = "\n".join(f"- {c['term']}: {c['definition']}" for c in research.get("key_concepts", []))
    return f"KEY CONCEPTS\n{concepts}\n\nNOTES\n{research.get('notes', '')}"


# --------------------------------------------------------------- Explainer
async def explainer(topic: str, plan: dict, research: dict, emit: Emit) -> dict:
    resp = await llm.call([
        {"role": "system", "content":
            "You are an explainer agent: a great teacher. Write a clear, engaging article in Markdown "
            "that teaches the topic from the notes. Structure: a short intro, one ## section per subtopic, "
            "concrete examples or analogies, a '## Key takeaways' bullet list. Use only the provided notes "
            "for facts. 600-900 words. Start with a # title."},
        {"role": "user", "content": f"Topic: {topic}\nSubtopics: {plan['subtopics']}\n\n{_notes_blob(research)}"},
    ])
    return {"markdown": resp.choices[0].message.content}


# ------------------------------------------------------------ Quiz Master
async def quiz_master(topic: str, research: dict, emit: Emit, n: int = 8) -> dict:
    data = await llm.ask_json(
        "You are a quiz-master agent. Write multiple-choice questions that test understanding, not trivia, "
        "using only the notes. Mix easy and hard. "
        f'Reply as JSON: {{"questions": [{{"question": str, "options": [exactly 4 strings], '
        f'"answer_index": 0-3, "explanation": str}}]}} with {n} questions. Vary the position of the correct answer.',
        f"Topic: {topic}\n\n{_notes_blob(research)}")
    good = []
    for q in data.get("questions", []):
        if (isinstance(q.get("options"), list) and len(q["options"]) == 4
                and isinstance(q.get("answer_index"), int) and 0 <= q["answer_index"] < 4):
            good.append(q)
    return {"questions": good}


# -------------------------------------------------------------- Diagrammer
async def diagrammer(topic: str, plan: dict, research: dict, emit: Emit) -> dict:
    data = await llm.ask_json(
        "You are a diagram agent. Produce 2-3 Mermaid diagrams that explain the topic visually "
        "(e.g. a process flowchart, a concept mindmap, a timeline if history matters). "
        'Reply as JSON: {"diagrams": [{"title": str, "kind": str, "code": str}]}.\n' + MERMAID_RULES,
        f"Topic: {topic}\nSubtopics: {plan['subtopics']}\n\n{_notes_blob(research)}")
    diagrams = []
    for d in data.get("diagrams", []):
        d["code"] = clean_mermaid(d.get("code", ""))
        if d["code"]:
            diagrams.append(d)
    return {"diagrams": diagrams}


async def repair_diagram(code: str, error: str) -> str:
    """Called by the UI when Mermaid fails to render: the diagram agent's self-repair loop."""
    data = await llm.ask_json(
        'You fix broken Mermaid diagrams. Reply as JSON: {"code": str} with the corrected diagram.\n' + MERMAID_RULES,
        f"This Mermaid failed to render.\n\nERROR:\n{error}\n\nCODE:\n{code}")
    return clean_mermaid(data.get("code", code))
