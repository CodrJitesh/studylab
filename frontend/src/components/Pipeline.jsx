const AGENTS = [
  ['planner', 'Planner', 'Breaks the topic down'],
  ['researcher', 'Researcher', 'Reads Wikipedia'],
  ['explainer', 'Explainer', 'Writes the article'],
  ['quiz', 'Quiz Master', 'Builds the quiz'],
  ['diagrammer', 'Diagrammer', 'Draws diagrams'],
]
const DOT = {
  idle: 'bg-slate-600', running: 'bg-amber-400 animate-pulse', done: 'bg-emerald-400', error: 'bg-rose-500',
}

export default function Pipeline({ status, logs }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {AGENTS.map(([key, name, desc]) => (
        <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[status[key] || 'idle']}`} />
            <span className="text-sm font-semibold">{name}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">{desc}</div>
          {logs[key]?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
              {logs[key].slice(-3).map((l, i) => <li key={i} className="truncate">› {l}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
