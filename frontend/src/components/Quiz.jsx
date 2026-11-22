import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, RotateCcw, Lightbulb } from 'lucide-react'
import { Pending } from './Skeleton'

function ScoreRing({ score, total }) {
  const pct = score / total, r = 52, c = 2 * Math.PI * r
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke="url(#g)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#e879f9" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><div className="font-display text-3xl font-bold">{score}/{total}</div><div className="text-xs text-slate-400">{Math.round(pct * 100)}%</div></div>
      </div>
    </div>
  )
}

const verdict = (p) => p === 1 ? 'Flawless. You own this topic.' : p >= 0.75 ? 'Strong grasp — review the misses below.' : p >= 0.5 ? 'Getting there. Re-read the article and retry.' : 'Fresh territory. The article is a good place to start.'

export default function Quiz({ quiz }) {
  const [picked, setPicked] = useState({})
  const [done, setDone] = useState(false)
  if (!quiz) return <Pending who="Quiz Master">is writing questions…</Pending>
  const qs = quiz.questions
  if (!qs.length) return <Pending who="Quiz Master">produced no valid questions.</Pending>
  const answered = Object.keys(picked).length
  const score = qs.filter((q, i) => picked[i] === q.answer_index).length
  const reset = () => { setPicked({}); setDone(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {done ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
          <ScoreRing score={score} total={qs.length} />
          <p className="text-slate-300">{verdict(score / qs.length)}</p>
          <button onClick={reset} className="mt-1 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"><RotateCcw size={14} />Retake</button>
        </motion.div>
      ) : (
        <div className="glass sticky top-3 z-10 flex items-center gap-3 rounded-xl px-4 py-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" animate={{ width: `${(answered / qs.length) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-400">{answered}/{qs.length}</span>
        </div>
      )}

      {qs.map((q, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }} className="glass rounded-2xl p-5">
          <div className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-xs font-semibold text-slate-300">{i + 1}</span>
            <div className="font-medium leading-snug text-slate-100">{q.question}</div>
          </div>
          <div className="mt-4 space-y-2">
            {q.options.map((o, j) => {
              const sel = picked[i] === j, right = j === q.answer_index
              let cls = sel ? 'border-indigo-400/70 bg-indigo-500/15' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
              if (done && right) cls = 'border-emerald-400/70 bg-emerald-500/15'
              else if (done && sel) cls = 'border-rose-400/70 bg-rose-500/15'
              return (
                <button key={j} disabled={done} onClick={() => setPicked({ ...picked, [i]: j })}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${cls}`}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/20 text-[10px] text-slate-400">{'ABCD'[j]}</span>
                  <span className="flex-1">{o}</span>
                  {done && right && <Check size={16} className="text-emerald-300" />}
                  {done && sel && !right && <X size={16} className="text-rose-300" />}
                </button>
              )
            })}
          </div>
          {done && q.explanation && (
            <p className="mt-4 flex gap-2 rounded-lg bg-amber-400/5 p-3 text-xs leading-relaxed text-slate-300"><Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-300" />{q.explanation}</p>
          )}
        </motion.div>
      ))}

      {!done && (
        <button disabled={answered < qs.length} onClick={() => { setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3 font-semibold shadow-lg shadow-indigo-500/20 transition disabled:opacity-30">
          {answered < qs.length ? `Answer all questions (${qs.length - answered} left)` : 'Submit answers'}
        </button>
      )}
    </div>
  )
}
