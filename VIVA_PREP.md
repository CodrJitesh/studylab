# StudyLab — Study & Viva Guide

Everything you need to explain, defend and demo this project. Line numbers refer to the code as committed; if you edit files they will drift, so search by function name.

---

## 0. The 30-second pitch

> StudyLab is a multi-agent study system. You type a topic. A **Planner** agent breaks it down, a **Researcher** agent uses **Wikipedia tools in a plan-act loop** to gather sources, then three agents run **in parallel** — an **Explainer** (markdown article), a **Quiz Master** (multiple-choice quiz you take in the UI) and a **Diagrammer** (Mermaid diagrams, with a **self-repair loop** when a diagram fails to render). The backend streams every agent's progress to a React UI over **Server-Sent Events**, so you watch the agents work live. The LLM is `openai/gpt-oss-20b` on Groq's free tier, reached through the OpenAI-compatible SDK.

---

## 1. Architecture at a glance

```
Browser (React + Vite)                         Backend (FastAPI, Python)
┌──────────────────────┐   GET /api/run?topic   ┌────────────────────────────────────────┐
│ App.jsx              │ ─────────────────────▶ │ main.py  run()  → asyncio.Queue        │
│  EventSource (SSE)   │ ◀───── data: {...} ─── │          pipeline()                    │
│  state: status, logs │                        │   1. planner ──▶ plan JSON             │
│  out{agent: output}  │                        │   2. researcher ─▶ notes + sources     │
│                      │                        │        ▲ tool loop: wikipedia_search / │
│ Diagrams.jsx         │  POST /api/diagram/    │        │            wikipedia_page     │
│  mermaid.parse/render│ ─────repair──────────▶ │   3. asyncio.gather(                   │
│  on failure → repair │ ◀──── fixed code ───── │        explainer, quiz, diagrammer)    │
└──────────────────────┘                        └───────────────┬────────────────────────┘
                                                                │ llm.py → lanes.py
                                                                ▼
                                          OpenAI SDK ──▶ Groq (openai/gpt-oss-20b)
                                          Wikipedia Action API (httpx)
```

**Flow:** `Planner → Researcher → [Explainer ‖ Quiz ‖ Diagrammer]`

| Layer | Tech | Why |
|---|---|---|
| Backend | FastAPI + uvicorn | async-native, easy SSE via `StreamingResponse` |
| LLM access | `openai` Python SDK → Groq | Groq speaks the OpenAI chat-completions protocol, so one SDK covers Groq/Ollama/Azure |
| Model | `openai/gpt-oss-20b` (open-weight, mixture-of-experts, ~21B params total / ~3.6B active per OpenAI's release notes) | free on Groq, fast, supports tool calling + JSON mode |
| Tools | Wikipedia Action API via `httpx` | real research, no API key |
| Streaming | Server-Sent Events | one-way server→browser push; simpler than WebSockets |
| Frontend | React 19 + Vite + Tailwind v4 + Framer Motion | components, fast dev loop, animation |
| Rendering | `react-markdown` + `remark-gfm`, `mermaid` | article + diagrams |

---

## 2. File map (what to open during the viva)

| File | Role | Key symbols |
|---|---|---|
| [backend/lanes.py](backend/lanes.py) | Provider/model resolver ("one socket, many plugs") | `LANES` (66), `_lane` (109), `get_model` (127), `get_client` (142), `describe` (188) |
| [backend/llm.py](backend/llm.py) | Async LLM wrapper: retries, JSON handling | `call` (24), `parse_json` (39), `ask_json` (51) |
| [backend/tools.py](backend/tools.py) | Researcher's tools + their JSON schemas | `_get` (12), `wikipedia_search` (27), `wikipedia_page` (37), `TOOL_SCHEMAS` (47) |
| [backend/agents.py](backend/agents.py) | The five agents + Mermaid cleanup | `clean_mermaid` (22), `planner` (34), `researcher` (47), `explainer` (133), `quiz_master` (146), `diagrammer` (167), `repair_diagram` (181) |
| [backend/main.py](backend/main.py) | HTTP API, orchestration, SSE | `pipeline` (31), `run` (55), `repair` (89), `health` (19) |
| [frontend/src/App.jsx](frontend/src/App.jsx) | Page, SSE client, global state | `run()` opens `EventSource`, reduces events into state |
| [frontend/src/components/Pipeline.jsx](frontend/src/components/Pipeline.jsx) | Animated agent flow | `AgentCard`, `Arrow` |
| [frontend/src/components/Activity.jsx](frontend/src/components/Activity.jsx) | Live log feed | |
| [frontend/src/components/Article.jsx](frontend/src/components/Article.jsx) | Markdown render, key concepts, sources | |
| [frontend/src/components/Quiz.jsx](frontend/src/components/Quiz.jsx) | Take quiz, score ring, explanations | `ScoreRing` |
| [frontend/src/components/Diagrams.jsx](frontend/src/components/Diagrams.jsx) | Render Mermaid + **repair loop** | `Diagram` (useEffect loop) |
| [frontend/src/agents.js](frontend/src/agents.js) | Agent names/icons/colours | |
| [frontend/vite.config.js](frontend/vite.config.js) | Dev proxy `/api → :8000` | |

---

## 3. Model & wiring (very likely viva territory)

### 3.1 Which model, how it's reached
- **Provider:** Groq (free tier). **Model:** `openai/gpt-oss-20b`.
- **Base URL:** `https://api.groq.com/openai/v1`. **Key:** `GROQ_API_KEY` in `.env` (gitignored; `.env.example` is committed).
- **SDK:** `openai.OpenAI(base_url=..., api_key=...)` — Groq implements the OpenAI chat-completions protocol, so no Groq-specific SDK is needed.
- **Switching providers:** change `PROVIDER=groq|local|foundry` in `.env`. `lanes.py` holds a `Lane` dataclass per provider (base URL, key env var, default model). `local` = Ollama at `localhost:11434/v1`, no key. `foundry` = Microsoft Foundry via `AZURE_OPENAI_ENDPOINT`. The old `github` lane is marked `retired`.
- **Model override:** `MODEL=` in `.env`. `get_model()` guards against an obviously wrong name for Groq (`lanes.py:127`).
- **Client config:** `timeout=60s`, `max_retries=3` (SDK-level) for Groq; Ollama gets 180 s / 1 retry because local models are slow.
- The client is created lazily once and cached (`llm.client()`, `llm.py:13`).
- `lanes.py` was reused from my earlier project (the budget agent), itself taken from the course repo. `python-dotenv` is optional — there's a fallback `.env` parser (`_load_env`, l.24).

### 3.2 How a call is made — `llm.call` (`llm.py:24`)
- The OpenAI SDK is **synchronous**. FastAPI is async. So each request runs in a worker thread: `await asyncio.to_thread(_create, messages=..., **kw)`. This keeps the event loop free so SSE keeps streaming and the three parallel agents genuinely overlap.
- **Retry with exponential backoff:** up to 4 retries, starting at 2 s and doubling, but only when the error text looks transient (`429`, `rate`, `timeout`, `500/502/503`). Non-transient errors raise immediately.

### 3.3 Getting structured output — `ask_json` (`llm.py:51`)
Agents must return JSON that code can use (plans, quiz, diagrams). Three layers of defence:
1. `response_format={"type": "json_object"}` (JSON mode) + the system prompt says "Reply with ONLY a JSON object".
2. `parse_json` strips ```` ```json ```` fences and, if parsing fails, regex-extracts the first `{...}` block.
3. If it still fails, **re-ask** the model with "That was not valid JSON…". If Groq's strict JSON mode itself rejects the output with a **400** (`Failed to validate JSON`), switch `strict=False` and retry without `response_format`, then parse by hand.

### 3.4 Prompting approach
- Every agent has a **role-setting system prompt** + a user message with the data it needs.
- Output **schemas are given in the prompt** (e.g. quiz: `{"questions":[{"question","options"×4,"answer_index","explanation"}]}`) and then **validated in code** (quiz checks exactly 4 options and `0 ≤ answer_index < 4`).
- Grounding: Explainer / Quiz / Diagrammer are told to use only the research notes.

---

## 4. The agents, one by one

| # | Agent | Function | Input | Output | LLM calls | Tools? |
|---|---|---|---|---|---|---|
| 1 | Planner | `planner` l.34 | topic | `{title, level, subtopics[3-6], search_queries[2-3]}` | 1 (JSON) | no |
| 2 | Researcher | `researcher` l.47 | topic + plan | `{key_concepts[], notes (md), sources[]}` | up to 6 tool-loop turns + 1 JSON summary | **yes** |
| 3 | Explainer | `explainer` l.133 | topic, plan, notes | `{markdown}` 600–900-word article | 1 (free text) | no |
| 4 | Quiz Master | `quiz_master` l.146 | notes | `{questions[8]}` | 1–2 (JSON) | no |
| 5 | Diagrammer | `diagrammer` l.167 | plan, notes | `{diagrams[{title,kind,code}]}` 2–3 diagrams | 1 (JSON) (+ repair later) | no |

### 4.1 Researcher in detail (the real "agent" — know this cold)
This is a classic **plan–act–observe loop with function calling**:

1. Messages start as `system` (role + "use the tools, fetch 2–4 pages, say DONE when finished") and `user` (topic, subtopics, suggested searches).
2. Each turn: `llm.call(messages, tools=TOOL_SCHEMAS)`. If the reply has **no `tool_calls`**, the loop ends.
3. Otherwise append the assistant message (with its `tool_calls`), then for each call: parse `arguments` JSON, run the Python function, append a `{"role":"tool","tool_call_id":..., "content": <json result>}` message. The model sees the observation on the next turn.
4. `max_steps=6` caps the loop (cost/latency guard).
5. **Tools** (`tools.py`):
   - `wikipedia_search(query)` → list of `{title, snippet}` (default 5 hits).
   - `wikipedia_page(title)` → `{title, url, text}`; plain-text extract via `prop=extracts&explaintext=1`, `redirects=1`, truncated to 6000 chars.
   - Schemas are standard OpenAI function-calling JSON schemas in `TOOL_SCHEMAS`.
6. Example tool-call round trip (what actually goes over the wire):
   ```json
   // assistant → tool call
   {"name": "wikipedia_search", "arguments": "{\"query\": \"Black hole formation\"}"}
   // tool result appended back
   {"role":"tool","tool_call_id":"call_abc","content":"[{\"title\":\"Black hole\",\"snippet\":\"...\"}, ...]"}
   // next turn
   {"name": "wikipedia_page", "arguments": "{\"title\": \"Event horizon\"}"}
   ```
7. **Sources are not LLM-generated.** The `sources` list is built from pages the code actually fetched (`pages` dict), so citations can't be hallucinated.
8. **Top-up safety net:** if the model fetched fewer than 2 pages, code searches the plan's queries (1 hit each) and fetches until it has up to 3 pages. If no pages at all → `RuntimeError` ("rate-limited? try again") so the UI shows a clear failure instead of fabricating.
9. **Malformed tool calls:** gpt-oss on Groq occasionally emits a broken tool name (e.g. `wikipedia_page<|channel|>commentary`) and Groq rejects it with HTTP 400. The loop catches it, logs "malformed tool call, retrying", retries the turn, and gives up after 3 (`bad_calls`), falling through to the top-up.
10. **Distillation:** a final `ask_json` call turns the raw page text (capped at 14 000 chars) into `key_concepts` + markdown `notes`.
11. **Context-size limits:** page text fed back to the model is cut to 3500 chars per tool result, and each tool message to 5000 chars — to keep the conversation inside the free-tier token budget.
12. Progress is surfaced via `emit({"type":"log","agent":"researcher","text":'search: "..."'})`, which is what lights up the activity feed.

### 4.2 Diagrammer + self-repair loop
- The agent asks for 2–3 diagrams as JSON; `MERMAID_RULES` in the prompt (quote every label, unique ids, simple ASCII ids, allowed kinds) reduces syntax errors.
- **`clean_mermaid`** (`agents.py:22`) post-processes: converts literal `\n` to real newlines (the model double-escapes them inside JSON — this broke *every* diagram originally), strips code fences, and indents mindmap nodes (Mermaid requires nodes indented under `mindmap`).
- **Repair loop (client-driven):** `Diagrams.jsx` calls `mermaid.parse(code)` then `mermaid.render`. On error it POSTs `{code, error}` to `/api/diagram/repair`; `repair_diagram` (`agents.py:181`) asks the LLM to fix the code given the exact parser error; the frontend retries — up to **2 repairs**, then shows the raw code with an error message. This is a genuine feedback loop: **observation = real parser error**, action = LLM revision.
- `suppressErrorRendering: true` stops Mermaid from injecting its "bomb" error SVG into the page.

---

## 5. Orchestration & streaming

### 5.1 Pipeline (`main.py:31`)
```python
plan     = await run("planner", ...)
research = await run("researcher", ...)
await asyncio.gather(run("explainer"...), run("quiz"...), run("diagrammer"...))
```
- `run()` (inner helper) emits `start`, executes, emits `done` with the output — or catches the exception and emits `error` for just that agent.
- **Dependency-driven:** Planner → Researcher are sequential (each needs the previous output). The last three only depend on `research`, so they're independent → `asyncio.gather` runs them concurrently. Total latency ≈ planner + researcher + max(three), not the sum.
- **Failure isolation:** if Explainer fails, Quiz and Diagrammer still finish. If Planner or Researcher fails the pipeline stops (nothing downstream can run).
- The orchestrator is **deterministic code**, not an LLM.

### 5.2 SSE streaming (`main.py:55`)
- `GET /api/run?topic=...` returns `StreamingResponse(media_type="text/event-stream")`.
- An `asyncio.Queue` decouples producers from the stream: agents call `emit(event)` → `queue.put`; the generator `stream()` does `queue.get()` and yields `data: {json}\n\n`. A background task (`driver`) runs the pipeline and puts a final `{"type":"finished"}` so the stream closes.
- Headers `Cache-Control: no-cache` and `X-Accel-Buffering: no` stop proxies from buffering events.
- If the browser disconnects, the generator's `finally` cancels the task.
- **Event types:** `start`, `log`, `done` (carries the agent's full output), `error`, `finished`.
- Why SSE not WebSockets: traffic is one-way (server → client), `EventSource` auto-handles framing, and it works over plain HTTP.

### 5.3 Frontend consumption (`App.jsx` → `run()`)
- `new EventSource('/api/run?topic=…')`; `onmessage` parses JSON and reduces into state: `status[agent]` (`idle|running|done|error`), `logs[agent]`, `times[agent]`, `feed[]`, `out[agent]` (the outputs).
- Tabs render from `out.explainer`, `out.quiz`, `out.diagrammer`; each shows a shimmer skeleton while its output is `undefined` and a "didn't finish" card (with retry) if the run ended without it.
- When all five outputs are in, the pipeline collapses to a one-line summary.
- Vite proxies `/api` to `127.0.0.1:8000`, so there's no CORS configuration.

---

## 6. Honest framing: how "agentic" is it? (examiners love this)

| Component | Autonomy |
|---|---|
| Researcher | **Truly agentic**: the LLM decides *which* tool to call, with what arguments, and *when to stop*; observations feed back into the next decision. |
| Diagrammer + client | **Feedback loop**: render error → LLM fix → re-render. |
| Planner, Explainer, Quiz Master | **Single-shot LLM workers** with specialised prompts — they don't loop or use tools. |
| Orchestrator | **Fixed workflow** in code (a DAG), not an LLM-chosen plan. The Planner's output only shapes prompts; it doesn't route which agents run. |

Be upfront: it's a **multi-agent pipeline with one tool-using agent and one self-correcting loop**, not a fully autonomous swarm. Why that's a reasonable choice: deterministic orchestration is cheaper, faster, debuggable and reliable on a small free model. Possible extension: let the Planner decide which agents to run, or add a Critic that sends bad quiz questions back.

---

## 7. Why multi-agent instead of one big prompt?
- **Specialisation:** short focused prompts → better, more consistent output than one giant prompt.
- **Parallelism:** three outputs generated simultaneously → faster.
- **Fault isolation:** one failure doesn't lose everything; each agent can be retried/improved separately.
- **Different output shapes:** markdown prose vs. strict JSON vs. diagram DSL — easier to prompt and validate separately.
- **Observability:** per-agent status/timing/log is what makes the live UI possible.
- Trade-off: more total tokens (each agent re-reads the notes), more moving parts.

---

## 8. Known limitations, risks, and what I'd say about them

- **Free-tier token budget.** Groq's free tier for this model has a **tokens-per-day cap (200 000)** plus per-minute limits. A full run uses a lot of tokens (each of the three parallel agents re-reads the notes), and during development I exhausted the daily quota, which surfaced as a `429 RateLimitError` in the UI. Mitigations: backoff retries, short prompts, truncation limits. Next steps: use a smaller model for light agents (Groq counts quota per model), trim notes, cache results per topic.
- **Quiz correctness is not verified.** There's no Critic/fact-check agent (dropped by design). The quiz is grounded in notes, structurally validated, but a wrong "correct answer" is possible.
- **Wikipedia-only research, English only;** quality depends on search hits (it once read an irrelevant page — top-up logic now prefers plan queries first, 1 hit each).
- **LLM output is non-deterministic** — diagram quality varies (e.g. reused node ids make messy graphs); the repair loop fixes syntax errors, not poor layout.
- **No persistence/auth/multi-user:** results live only in browser state; refresh loses them. No history.
- **Security notes:** API key is server-side only (browser never sees it); `.env` is gitignored. Mermaid is initialised with `securityLevel: 'loose'` and SVG is injected with `dangerouslySetInnerHTML` — acceptable here since SVG comes from our own pipeline, but untrusted input would need `strict`. Topic goes into prompts → prompt injection via Wikipedia text is possible in principle.
- **Not verified end-to-end at the end of development:** the final hardening changes (JSON-mode fallback in `ask_json`, quiz regeneration when <5 valid questions, mindmap indent fix) were unit-checked/compiled, but a full live run was blocked by the exhausted quota. **Re-run a full topic once before the viva** to confirm.

---

## 9. Viva Q&A

### Concept questions

**Q1. What is an agent, and is your system one?**
An agent is an LLM in a loop that can choose actions (tools), observe results, and decide the next step. The Researcher is a true agent: it picks `wikipedia_search`/`wikipedia_page`, reads results, and decides when it's done. The whole system is a multi-agent *pipeline*: several specialised LLM roles coordinated by deterministic code.

**Q2. Why multi-agent instead of one prompt?**
See §7 — specialisation, parallelism, fault isolation, easier validation, observability.

**Q3. How do the agents communicate?**
Through structured data passed by the orchestrator: Planner's JSON → Researcher; Researcher's `{key_concepts, notes, sources}` → the three downstream agents. There's no free-form agent-to-agent chat; the orchestrator (`pipeline()`) is the message bus. Simple and debuggable.

**Q4. Who decides the workflow — the LLM or code?**
Code. The DAG is fixed. Only the Researcher has LLM-driven control flow (tool choice and stopping).

**Q5. What tools does your agent have and how are they defined?**
Two: `wikipedia_search(query)` and `wikipedia_page(title)`, defined as OpenAI-style function schemas (`TOOL_SCHEMAS` in `tools.py`: name, description, JSON-schema parameters). They hit the Wikipedia Action API with `httpx`.

**Q6. Walk me through a tool call.**
We send `messages` + `tools` to the model. If the model wants a tool, the response has `message.tool_calls` (id, function name, JSON-string arguments) instead of final text. We `json.loads` the arguments, run the Python function, then append the assistant message and a `role:"tool"` message with the same `tool_call_id` and the JSON result, and call the model again. It stops calling tools when it has enough (or after `max_steps=6`).

**Q7. How do you stop it looping forever or wasting tokens?**
`max_steps=6`, truncated tool outputs (3500/5000 chars), page cap (6000), and a fallback path that doesn't need more LLM turns.

**Q8. How do you prevent hallucinated sources?**
Sources are built from pages the code actually fetched, not from model text. Notes are generated from fetched text with an instruction to include only supported facts. (It reduces but doesn't eliminate hallucination in the notes/quiz.)

**Q9. What happens if a tool fails?**
Inside the loop, exceptions become `{"error": ...}` returned to the model as the tool result so it can adapt. Wikipedia 429/5xx are retried with backoff (`tools._get`). If nothing could be fetched, the Researcher raises and the UI shows the failure and a retry button.

**Q10. How do you get reliable JSON from a small model?**
JSON mode + explicit schema in the prompt + tolerant parser + re-ask + fallback to non-strict mode + schema validation in code (e.g. quiz options/answer index). Never trust the model's output without validating it.

**Q11. Explain the self-repair loop.**
The Diagrammer's Mermaid can be syntactically invalid. The browser validates with `mermaid.parse`. On failure it sends the code and the exact parser error to `/api/diagram/repair`, the LLM returns corrected code, and the browser re-validates. Max 2 repairs, then show the raw code. It's an observe→reflect→act loop driven by a real, objective error signal.

**Q12. Why is repair triggered from the frontend and not the backend?**
Mermaid is a JavaScript library; the browser is the authoritative validator. Doing it server-side would need a Node/headless renderer. Trade-off: the loop depends on the client and isn't saved.

### Technical / implementation questions

**Q13. Why `asyncio.to_thread` around the OpenAI call?**
The SDK client is synchronous; calling it directly would block the event loop, stalling SSE and serialising the parallel agents. `to_thread` runs it in a worker thread so `asyncio.gather` really overlaps the three calls.

**Q14. Why `asyncio.gather` for those three but sequential for the first two?**
Data dependency. Researcher needs the plan; Explainer/Quiz/Diagrammer need the research but not each other. Parallel cuts wall-clock time to roughly the slowest of the three.

**Q15. How does the streaming work? Why SSE?**
Agents push events into an `asyncio.Queue`; the endpoint is an async generator yielding `data: {json}\n\n` with `text/event-stream`. SSE is one-way, auto-reconnecting, simple over HTTP; we don't need the browser to send messages mid-run, so WebSockets would be overkill.

**Q16. What does the browser do with the events?**
`EventSource.onmessage` → switch on `type` → update React state (`status`, `logs`, `out`, `times`, `feed`). The UI is a pure function of that state.

**Q17. How is rate limiting handled?**
`llm.call` retries transient errors with exponential backoff (2 s, 4 s, 8 s, 16 s); `tools._get` honours `Retry-After` for Wikipedia. Groq's *daily* token limit can't be retried away — the UI shows the error clearly.

**Q18. Why Groq and `gpt-oss-20b`?**
Free tier, very fast inference, OpenAI-compatible API, and the model supports tool calling and JSON mode. It's a small model, so I compensate with validation, retries and short focused prompts.

**Q19. How would you swap to another model/provider?**
Edit `PROVIDER` / `MODEL` in `.env`; `lanes.py` resolves base URL, key and model. Agents only call `get_client()`/`get_model()`, so no agent code changes.

**Q20. Where's temperature / sampling set?**
Not set — I use provider defaults. If asked: I'd lower temperature for the JSON agents (Quiz/Diagrammer) for stability and keep default for the Explainer. *(Honest answer: not tuned.)*

**Q21. How is state/memory handled?**
Per-request only: the pipeline passes data in memory; the frontend holds results in React state. No database, no cross-session memory. (The earlier budget agent had a `Memory` class; this one doesn't need cross-turn memory.)

**Q22. What's in `lanes.py` and why copy it?**
A resolver that centralises provider config (base URL, key env var, default model) so the rest of the code is provider-agnostic. Reused from the course repo/earlier project to avoid re-solving config.

**Q23. How does the quiz scoring work?**
Entirely client-side. The LLM provides `answer_index` and `explanation` per question; `Quiz.jsx` compares the user's picked index to it, shows a score ring and marks right/wrong after submit. Answers are in the payload (fine for a self-study tool, not for a graded exam).

**Q24. How do you render the article safely?**
`react-markdown` renders Markdown to React elements (no raw HTML injection by default); typography via Tailwind's `prose` classes.

**Q25. Why Vite proxy rather than CORS?**
In dev, the browser calls same-origin `/api/*`; Vite forwards to FastAPI on :8000. No CORS config or exposed origins.

### Critical-thinking / "what if" questions

**Q26. Biggest weakness?**
No verification of factual correctness of quiz/article beyond grounding. I'd add a Critic agent that cross-checks quiz answers against the notes and sends bad questions back (I deliberately left it out of scope).

**Q27. How would you evaluate quality?**
Structural: % of runs where JSON validates, diagrams render on first try vs after repair, # valid quiz questions. Content: spot-check quiz answers against the Wikipedia source; human rating of the article; compare to a single-prompt baseline.

**Q28. How would you scale it?**
Move the pipeline to a job queue, cache by topic, persist results in a DB, use per-agent model selection, add auth and per-user rate limits, and run multiple workers behind a load balancer (SSE needs sticky connections or pub/sub like Redis).

**Q29. What if Wikipedia returns a wrong/irrelevant page?**
Currently possible; the plan's queries are used first and only one hit per query for top-up. Improvements: relevance scoring, requiring the model to justify the choice, or adding more sources.

**Q30. Prompt-injection risk?**
Wikipedia text enters prompts, so a malicious page could try to steer the model. Impact here is limited (no sensitive tools, no secrets in context, outputs are only displayed). With powerful tools I'd isolate and sanitise tool output.

**Q31. What did you debug along the way?** (good story)
1. Diagrams all failed → model double-escaped `\n` in JSON → `clean_mermaid`.
2. Researcher crashed on Groq 400 → malformed tool-call name from gpt-oss → retry + fallback.
3. Wikipedia 429 under repeated testing → backoff in `_get` + graceful degradation.
4. Groq strict-JSON 400s → non-strict fallback.
5. Mindmaps failed → root not indented → normalise indentation.
6. Hit the daily token cap → showed the failure state properly; planned per-agent model split.

**Q32. Why not LangChain/CrewAI/AutoGen?**
The control flow is small and explicit; hand-rolling it shows exactly how tool calling, retries and orchestration work, with fewer dependencies and full control over streaming events. Frameworks would help for larger graphs, memory and tracing.

---

## 10. Demo script (≈3 minutes)

1. **Before the viva:** check quota/connection. Start the servers (see §11) and do **one full dry run** on a topic you'll reuse.
2. Open the landing page; point out the five agents and the flow arrows.
3. Type a topic (or click a chip). Narrate: "Planner is splitting the topic… Researcher is *choosing* to search and read pages — see the live log… now three agents run in parallel."
4. Show **Activity feed** (tool calls, timings) → evidence of real tool use.
5. **Article tab:** point at key concepts and **Researched from** (real Wikipedia links).
6. **Quiz tab:** answer, submit, show score ring and explanations.
7. **Diagrams tab:** show a diagram; click Expand/Copy; if one shows "Diagrammer is repairing…", explain the loop.
8. Show `agents.py:researcher` and `main.py:pipeline` in the editor if asked how it's wired.

Backup plan: if the API is rate-limited, show the error UI (it's graceful) and walk through the code and a previously captured screenshot.

---

## 11. Run commands & config cheat-sheet

```bash
# one-time
cp .env.example .env            # put GROQ_API_KEY=... (free: console.groq.com/keys)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd frontend && npm install && cd ..

# run (two terminals, repo root)
.venv/bin/uvicorn backend.main:app --port 8000
cd frontend && npm run dev          # http://localhost:5173 (or the port Vite prints)

# sanity checks
curl localhost:8000/api/health                       # shows lane + model
curl -N "localhost:8000/api/run?topic=Photosynthesis" # raw SSE stream
```

| Setting | Where | Value |
|---|---|---|
| Provider | `.env` `PROVIDER` | `groq` (default) |
| Model | `lanes.py` default / `.env` `MODEL` | `openai/gpt-oss-20b` |
| SDK timeout / retries | `lanes.py` | 60 s / 3 (Groq) |
| LLM backoff | `llm.call` | 4 retries, 2 s doubling |
| Researcher steps | `researcher(max_steps=6)` | 6 |
| Page text cap | `wikipedia_page(max_chars=6000)` | 6000 |
| Tool result to model | `agents.py` | 3500 chars / 5000 per message |
| Notes input cap | `agents.py` | 14 000 chars |
| Quiz size | `quiz_master(n=8)` | 8 questions, regenerate if <5 valid |
| Diagram repairs | `Diagrams.jsx` | 2 |
| Ports | | API 8000, Vite 5173 (auto-increments) |

**Numbers to remember:** 5 agents · 2 tools · 3 run in parallel · 6 max research steps · 8 quiz questions · 2 diagram repairs · 4 LLM retries.

---

## 12. Glossary
- **Tool/function calling:** the model returns a structured request to call a named function with JSON args instead of plain text.
- **Plan–act–observe loop (ReAct-style):** think → call tool → read result → repeat.
- **SSE:** HTTP response kept open that streams `data:` lines; browser API is `EventSource`.
- **JSON mode:** provider feature forcing syntactically valid JSON output.
- **Grounding:** constraining generation to supplied source text.
- **Mermaid:** text DSL rendered to SVG diagrams in the browser.
- **TPD / TPM:** tokens per day / per minute — Groq rate limits.
- **MoE (mixture of experts):** model architecture activating only a subset of parameters per token.
