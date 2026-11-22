# StudyLab

Type a topic; a team of AI agents builds a study pack — researched from Wikipedia, explained in Markdown, with a quiz you can take and Mermaid diagrams. See [PLAN.md](PLAN.md).

**Agents:** Planner → Researcher (Wikipedia tools) → Explainer ‖ Quiz Master ‖ Diagrammer (self-repairs broken Mermaid).

## Run
```bash
cp .env.example .env            # add GROQ_API_KEY (free at console.groq.com/keys)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.main:app --port 8000      # API
cd frontend && npm install && npm run dev            # UI (proxies /api to :8000)
```
LLM provider is chosen in `.env` (`PROVIDER=groq|local|foundry`) via `backend/lanes.py`.
