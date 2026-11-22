"""Thin async wrapper over the lane client: retries on rate limits, JSON parsing."""
from __future__ import annotations

import asyncio
import json
import re

from .lanes import get_client, get_model

_client = None


def client():
    global _client
    if _client is None:
        _client = get_client()
    return _client


def _create(**kw):
    return client().chat.completions.create(model=get_model(), **kw)


async def call(messages: list[dict], retries: int = 4, **kw):
    """Chat completion off the event loop, with backoff on 429/5xx."""
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            return await asyncio.to_thread(_create, messages=messages, **kw)
        except Exception as exc:  # openai raises typed errors; match on text to stay light
            msg = str(exc).lower()
            transient = any(s in msg for s in ("429", "rate", "timeout", "500", "502", "503"))
            if attempt == retries or not transient:
                raise
            await asyncio.sleep(delay)
            delay *= 2


def parse_json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise
        return json.loads(m.group(0))


async def ask_json(system: str, user: str, retries: int = 3) -> dict:
    """One call that must return a JSON object. Survives broken JSON: re-asks, and if the
    provider's strict JSON mode rejects the output (400), retries in plain mode and parses by hand."""
    messages = [{"role": "system", "content": system + "\nReply with ONLY a JSON object."},
                {"role": "user", "content": user}]
    strict, last = True, None
    for _ in range(retries + 1):
        try:
            kw = {"response_format": {"type": "json_object"}} if strict else {}
            resp = await call(messages, **kw)
        except Exception as exc:
            if "400" in str(exc) or "json" in str(exc).lower():
                strict, last = False, exc
                continue
            raise
        text = resp.choices[0].message.content
        try:
            return parse_json(text)
        except json.JSONDecodeError as exc:
            last = exc
            messages += [{"role": "assistant", "content": text or ""},
                         {"role": "user", "content": "That was not valid JSON. Reply with ONLY the JSON object; escape newlines inside strings as \\n."}]
    raise ValueError(f"model did not return valid JSON: {last}")
