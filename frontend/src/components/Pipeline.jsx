import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { AGENTS } from '../agents'

function AgentCard({ id, status = 'idle', logs = [], seconds }) {
  const a = AGENTS[id]
  const running = status === 'running'
  return (
    <motion.div layout className={`glass relative rounded-2xl p-3.5 transition-shadow ${running ? `ring-1 ${a.ring} shadow-[0_0_30px_-8px_currentColor] ${a.text}` : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.bg} ${a.text}`}>
          <a.Icon size={18} />
          {running && <span className={`absolute inset-0 animate-ping rounded-xl ${a.bg}`} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-100">{a.name}</div>
          <div className="truncate text-xs text-slate-400">{a.desc}</div>
        </div>
        <div className="shrink-0">
          {status === 'running' && <Loader2 size={16} className={`animate-spin ${a.text}`} />}
          {status === 'done' && <span className="flex items-center gap-1 text-xs text-emerald-300"><Check size={15} />{seconds != null && `${seconds}s`}</span>}
          {status === 'error' && <AlertTriangle size={16} className="text-rose-400" />}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {running && logs.length > 0 && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mt-2.5 space-y-0.5 overflow-hidden border-t border-white/5 pt-2 font-mono text-[11px] text-slate-400">
            {logs.slice(-2).map((l, i) => <li key={l + i} className="truncate">› {l}</li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Arrow({ active }) {
  return (
    <svg className="hidden h-8 w-10 shrink-0 self-center md:block" viewBox="0 0 40 32" fill="none">
      <path d="M2 16h30" stroke={active ? '#818cf8' : '#334155'} strokeWidth="2" className={active ? 'flow-line' : ''} strokeLinecap="round" />
      <path d="M30 9l7 7-7 7" stroke={active ? '#818cf8' : '#334155'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Pipeline({ status, logs, times }) {
  const card = (id) => <AgentCard key={id} id={id} status={status[id]} logs={logs[id]} seconds={times[id]} />
  const live = (id) => status[id] === 'running'
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      <div className="md:flex-1 md:self-center">{card('planner')}</div>
      <Arrow active={status.planner === 'done' || live('planner')} />
      <div className="md:flex-1 md:self-center">{card('researcher')}</div>
      <Arrow active={status.researcher === 'done' || live('researcher')} />
      <div className="flex flex-col gap-3 md:flex-1">
        {['explainer', 'quiz', 'diagrammer'].map(card)}
      </div>
    </div>
  )
}
