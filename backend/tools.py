"""Researcher tools: Wikipedia search + page fetch (no API key needed)."""
from __future__ import annotations

import httpx

API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "StudyLab/0.1 (student project)"}


async def wikipedia_search(query: str, limit: int = 5) -> list[dict]:
    async with httpx.AsyncClient(headers=HEADERS, timeout=20) as c:
        r = await c.get(API, params={"action": "query", "list": "search", "srsearch": query,
                                     "srlimit": limit, "format": "json"})
        r.raise_for_status()
    out = []
    for h in r.json()["query"]["search"]:
        snippet = h["snippet"].replace('<span class="searchmatch">', "").replace("</span>", "")
        out.append({"title": h["title"], "snippet": snippet})
    return out


async def wikipedia_page(title: str, max_chars: int = 6000) -> dict:
    async with httpx.AsyncClient(headers=HEADERS, timeout=20) as c:
        r = await c.get(API, params={"action": "query", "prop": "extracts|info", "inprop": "url",
                                     "explaintext": 1, "redirects": 1, "titles": title, "format": "json"})
        r.raise_for_status()
    page = next(iter(r.json()["query"]["pages"].values()))
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
