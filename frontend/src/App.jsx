import { useRef, useState } from 'react'
import Pipeline from './components/Pipeline'
import Article from './components/Article'
import Quiz from './components/Quiz'
import Diagrams from './components/Diagrams'

const TABS = [['article', 'Article'], ['quiz', 'Quiz'], ['diagrams', 'Diagrams']]

export default function App() {
  const [topic, setTopic] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState({})
  const [logs, setLogs] = useState({})
  const [out, setOut] = useState({})
  const [errors, setErrors] = useState([])
  const [tab, setTab] = useState('article')
  const [started, setStarted] = useState(false)
  const es = useRef(null)

  function run(e) {
    e.preventDefault()
    if (!topic.trim() || running) return
    es.current?.close()
    setStatus({}); setLogs({}); setOut({}); setErrors([]); setStarted(true); setRunning(true)
    const src = new EventSource(`/api/run?topic=${encodeURIComponent(topic.trim())}`)
    es.current = src
    src.onmessage = (m) => {
      const ev = JSON.parse(m.data)
      if (ev.type === 'start') setStatus((s) => ({ ...s, [ev.agent]: 'running' }))
      else if (ev.type === 'log') setLogs((l) => ({ ...l, [ev.agent]: [...(l[ev.agent] || []), ev.text] }))
      else if (ev.type === 'done') {
        setStatus((s) => ({ ...s, [ev.agent]: 'done' }))
        setOut((o) => ({ ...o, [ev.agent]: ev.output }))
      } else if (ev.type === 'error') {
        setStatus((s) => ({ ...s, [ev.agent]: 'error' }))
        setErrors((x) => [...x, `${ev.agent}: ${ev.text}`])
      } else if (ev.type === 'finished') { src.close(); setRunning(false) }
    }
    src.onerror = () => { src.close(); setRunning(false) }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-4xl font-bold text-transparent">StudyLab</h1>
        <p className="mt-2 text-slate-400">Type a topic. A team of AI agents builds your study pack.</p>
      </header>

      <form onSubmit={run} className="mx-auto mb-8 flex max-w-2xl gap-2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How do vaccines work?"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400" />
        <button disabled={running || !topic.trim()} className="rounded-lg bg-indigo-500 px-6 font-semibold disabled:opacity-40">
          {running ? 'Working…' : 'Generate'}
        </button>
      </form>

      {started && (
        <>
          <Pipeline status={status} logs={logs} />
          {errors.map((e, i) => <div key={i} className="mt-3 rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{e}</div>)}
          <div className="mt-8 flex gap-1 border-b border-white/10">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-indigo-400 text-white' : 'text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-6">
            {tab === 'article' && <Article article={out.explainer} research={out.researcher} />}
            {tab === 'quiz' && <Quiz key={out.quiz ? 'q' : 'n'} quiz={out.quiz} />}
            {tab === 'diagrams' && <Diagrams diagrams={out.diagrammer} />}
          </div>
        </>
      )}
    </div>
  )
}
