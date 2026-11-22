import { useEffect, useRef } from 'react'
import { AGENTS } from '../agents'

export default function Activity({ feed, running }) {
  const box = useRef(null)
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }) }, [feed.length])
  if (!feed.length) return null
  return (
    <div className="glass rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
        Live activity
      </div>
      <div ref={box} className="max-h-36 space-y-1 overflow-y-auto px-4 py-3 font-mono text-xs">
        {feed.map((f) => {
          const a = AGENTS[f.agent]
          return (
            <div key={f.id} className="flex gap-2">
              <span className="w-24 shrink-0 text-slate-600">{f.t}</span>
              <span className={`w-24 shrink-0 ${a.text}`}>{a.name}</span>
              <span className={f.kind === 'error' ? 'text-rose-400' : f.kind === 'done' ? 'text-emerald-300' : 'text-slate-300'}>{f.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
