import { useState } from 'react'
import { Empty } from './Article'

export default function Quiz({ quiz }) {
  const [picked, setPicked] = useState({})
  const [submitted, setSubmitted] = useState(false)
  if (!quiz) return <Empty text="The Quiz Master is thinking…" />
  const qs = quiz.questions
  if (!qs.length) return <Empty text="No valid questions were generated." />
  const score = qs.filter((q, i) => picked[i] === q.answer_index).length

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {submitted && (
        <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-center">
          <div className="text-3xl font-bold">{score} / {qs.length}</div>
          <button className="mt-2 text-sm text-indigo-300 hover:underline"
            onClick={() => { setPicked({}); setSubmitted(false) }}>Retake</button>
        </div>
      )}
      {qs.map((q, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="font-medium"><span className="text-slate-500">{i + 1}.</span> {q.question}</div>
          <div className="mt-3 space-y-2">
            {q.options.map((o, j) => {
              const sel = picked[i] === j
              let cls = sel ? 'border-indigo-400 bg-indigo-500/15' : 'border-white/10 hover:border-white/30'
              if (submitted && j === q.answer_index) cls = 'border-emerald-400 bg-emerald-500/15'
              else if (submitted && sel) cls = 'border-rose-400 bg-rose-500/15'
              return (
                <button key={j} disabled={submitted} onClick={() => setPicked({ ...picked, [i]: j })}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${cls}`}>{o}</button>
              )
            })}
          </div>
          {submitted && <p className="mt-3 text-xs text-slate-400">💡 {q.explanation}</p>}
        </div>
      ))}
      {!submitted && (
        <button disabled={Object.keys(picked).length < qs.length} onClick={() => setSubmitted(true)}
          className="w-full rounded-lg bg-indigo-500 py-2.5 font-semibold disabled:opacity-40">Submit answers</button>
      )}
    </div>
  )
}
