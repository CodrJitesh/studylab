"""Researcher tools: Wikipedia search + page fetch (no API key needed)."""
from __future__ import annotations

import asyncio

import httpx

API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "StudyLab/0.1 (student project)"}


async def _get(params: dict) -> dict:
    """GET the Wikipedia API, backing off on 429/5xx (it rate-limits bursts)."""
    delay = 1.5
    for attempt in range(4):
        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as c:
            r = await c.get(API, params=params)
        if r.status_code in (429, 500, 502, 503) and attempt < 3:
            wait = float(r.headers.get("retry-after", delay)) if r.headers.get("retry-after", "").isdigit() else delay
            await asyncio.sleep(min(wait, 8))
            delay *= 2
            continue
        r.raise_for_status()
        return r.json()


async def wikipedia_search(query: str, limit: int = 5) -> list[dict]:
    data = await _get({"action": "query", "list": "search", "srsearch": query,
                       "srlimit": limit, "format": "json"})
    out = []
    for h in data["query"]["search"]:
        snippet = h["snippet"].replace('<span class="searchmatch">', "").replace("</span>", "")
        out.append({"title": h["title"], "snippet": snippet})
    return out


async def wikipedia_page(title: str, max_chars: int = 6000) -> dict:
    data = await _get({"action": "query", "prop": "extracts|info", "inprop": "url",
                       "explaintext": 1, "redirects": 1, "titles": title, "format": "json"})
    page = next(iter(data["query"]["pages"].values()))
    if "missing" in page:
        return {"title": title, "url": "", "text": "", "error": "page not found"}
    return {"title": page["title"], "url": page.get("fullurl", ""),
            "text": (page.get("extract") or "")[:max_chars]}


TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "wikipedia_search",
        "description": "Search Wikipedia. Returns candidate page titles with snippets.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "wikipedia_page",
        "description": "Fetch the plain-text content of a Wikipedia page by exact title.",
        "parameters": {"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]}}},
]
