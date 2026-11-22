# StudyLab — plan (locked)

Enter a topic → a team of agents builds a study pack, streamed live to a React UI.

## Agents
| Agent | Job | Output |
|---|---|---|
| Planner | Splits the topic into subtopics, picks what to run | JSON plan |
| Researcher | Wikipedia search + page fetch tools, plan-act loop | Sourced notes + citations |
| Explainer | Main write-up from the notes | Markdown article |
| Quiz Master | MCQs with explanations, grounded in notes | Quiz JSON (taken + scored in UI) |
| Diagrammer | Mermaid flowchart / mindmap / timeline | Mermaid code, repair loop on render error |
| Flashcards (stretch) | Flip cards | Cards JSON |

Flow: Planner → Researcher → [Explainer ‖ Quiz ‖ Diagrammer] in parallel.

## Stack
- Backend: FastAPI, SSE event stream, asyncio.gather, Pydantic schemas. LLM via `backend/lanes.py` (Groq default).
- Frontend: React + Vite + Tailwind, `mermaid`, `react-markdown`, Framer Motion. Dark, pipeline view of agents lighting up; tabs Article / Quiz / Diagrams.
- `mock` mode returns canned output so the UI can be built without burning Groq quota.
- Retry/backoff on 429 (Groq free-tier TPM limits).

## Milestones
1. Backend skeleton: lanes, base Agent class, event bus, SSE endpoint, mock mode
2. Planner + Researcher (Wikipedia tools)
3. Explainer, Quiz, Diagrammer (+ repair loop)
4. React UI: topic input, live agent pipeline, article, quiz-taking, diagrams
5. Polish, README, demo
