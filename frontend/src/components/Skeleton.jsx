export function Lines({ n = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="shimmer h-4" style={{ width: `${95 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  )
}

export function Pending({ who, children }) {
  return (
    <div className="glass rounded-2xl p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /> {who} {children}
      </div>
      <Lines />
    </div>
  )
}

export function Failed({ who, onRetry }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="text-slate-300">{who} didn't finish.</div>
      <p className="mt-1 text-sm text-slate-500">An upstream agent failed or the model returned something unusable.</p>
      {onRetry && <button onClick={onRetry} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Try again</button>}
    </div>
  )
}
