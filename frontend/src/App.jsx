import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, Loader2, FileText, ListChecks, Workflow, AlertTriangle, ChevronDown, Check } from 'lucide-react'
import Pipeline from './components/Pipeline'
import Activity from './components/Activity'
import Article from './components/Article'
import Quiz from './components/Quiz'
import Diagrams from './components/Diagrams'
import { Failed } from './components/Skeleton'
import { AGENTS } from './agents'

const EXAMPLES = ['How do vaccines work?', 'The French Revolution', 'How does the internet work?', 'Black holes', 'Photosynthesis']

export default function App() {
  const [topic, setTopic] = useState('')
  const [current, setCurrent] = useState('')
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [status, setStatus] = useState({})
  const [logs, setLogs] = useState({})
  const [times, setTimes] = useState({})
  const [feed, setFeed] = useState([])
  const [out, setOut] = useState({})
  const [errors, setErrors] = useState([])
  const [tab, setTab] = useState('article')
  const [manual, setManual] = useState(false) // user toggled the pipeline details open
  const es = useRef(null)
  const t0 = useRef(0)
  const startAt = useRef({})

  const stamp = () => `+${((Date.now() - t0.current) / 1000).toFixed(1)}s`
  const push = (agent, kind, text) => setFeed((f) => [...f, { id: f.length, agent, kind, text, t: stamp() }])

  function run(q) {
    const t = (q ?? topic).trim()
    if (!t || running) return
    setTopic(t); setCurrent(t)
    es.current?.close()
    setStatus({}); setLogs({}); setTimes({}); setFeed([]); setOut({}); setErrors([]); setTab('article'); setManual(false)
    setStarted(true); setRunning(true)
    t0.current = Date.now(); startAt.current = {}
    const src = new EventSource(`/api/run?topic=${encodeURIComponent(t)}`)
    es.current = src
    src.onmessage = (m) => {
      const ev = JSON.parse(m.data)
      if (ev.type === 'start') {
        startAt.current[ev.agent] = Date.now()
        setStatus((s) => ({ ...s, [ev.agent]: 'running' })); push(ev.agent, 'start', 'started')
      } else if (ev.type === 'log') {
        setLogs((l) => ({ ...l, [ev.agent]: [...(l[ev.agent] || []), ev.text] })); push(ev.agent, 'log', ev.text)
      } else if (ev.type === 'done') {
        const secs = ((Date.now() - startAt.current[ev.agent]) / 1000).toFixed(1)
        setStatus((s) => ({ ...s, [ev.agent]: 'done' })); setTimes((x) => ({ ...x, [ev.agent]: secs }))
        setOut((o) => ({ ...o, [ev.agent]: ev.output })); push(ev.agent, 'done', `finished in ${secs}s`)
      } else if (ev.type === 'error') {
        setStatus((s) => ({ ...s, [ev.agent]: 'error' }))
        setErrors((x) => [...x, `${AGENTS[ev.agent].name}: ${ev.text}`]); push(ev.agent, 'error', ev.text)
      } else if (ev.type === 'finished') { src.close(); setRunning(false) }
    }
    src.onerror = () => { src.close(); setRunning(false) }
  }

  const collapsed = !running && errors.length === 0 && !manual && Object.keys(out).length === 5
  const total = feed.length ? feed[feed.length - 1].t.replace(/[+s]/g, '') : '0'
  const tabs = [
    ['article', 'Article', FileText, out.explainer ? '' : null],
    ['quiz', 'Quiz', ListChecks, out.quiz ? out.quiz.questions.length : null],
    ['diagrams', 'Diagrams', Workflow, out.diagrammer ? out.diagrammer.diagrams.length : null],
  ]

  return (
    <>
      <div className="ambient" />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <motion.header layout className={`text-center ${started ? 'mb-6' : 'mb-10 mt-[12vh]'}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <Sparkles size={13} className="text-fuchsia-300" /> Multi-agent study system
          </div>
          <h1 className={`mt-4 bg-gradient-to-r from-white via-indigo-200 to-fuchsia-300 bg-clip-text font-display font-bold tracking-tight text-transparent ${started ? 'text-4xl' : 'text-6xl sm:text-7xl'}`}>StudyLab</h1>
          {!started && <p className="mx-auto mt-4 max-w-md text-slate-400">Enter any topic. Five AI agents research it, write it up, quiz you and draw the diagrams.</p>}
        </motion.header>

        <motion.form layout onSubmit={(e) => { e.preventDefault(); run() }} className="mx-auto mb-4 max-w-2xl">
          <div className="glass flex items-center gap-2 rounded-2xl p-1.5 pl-5 focus-within:ring-1 focus-within:ring-indigo-400/60">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What do you want to learn?" autoFocus
              className="min-w-0 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-slate-500" />
            <button disabled={running || !topic.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 font-semibold shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-40">
              {running ? <><Loader2 size={17} className="animate-spin" />Working</> : <>Generate<ArrowRight size={17} /></>}
            </button>
          </div>
        </motion.form>

        <AnimatePresence>
          {!started && (
            <motion.div exit={{ opacity: 0, height: 0 }} className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => run(ex)} className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-white">{ex}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!started && (
          <div className="mx-auto mt-14 max-w-4xl"><Pipeline status={{}} logs={{}} times={{}} /></div>
        )}

        {started && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
            <div className="text-center text-sm text-slate-400">Study pack for <span className="font-medium text-slate-200">“{current}”</span></div>
            {collapsed ? (
              <button onClick={() => setManual(true)} className="glass flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 text-left text-xs text-slate-400 transition hover:bg-white/[0.06]">
                <span className="flex items-center gap-1.5 text-emerald-300"><Check size={14} />All agents done in {total}s</span>
                {Object.keys(AGENTS).map((k) => {
                  const a = AGENTS[k]
                  return <span key={k} className="flex items-center gap-1.5"><a.Icon size={13} className={a.text} />{a.name}<span className="tabular-nums text-slate-500">{times[k]}s</span></span>
                })}
                <span className="ml-auto flex items-center gap-1 text-slate-500">Details <ChevronDown size={14} /></span>
              </button>
            ) : (
              <>
                <Pipeline status={status} logs={logs} times={times} />
                <Activity feed={feed} running={running} />
                {manual && !running && (
                  <button onClick={() => setManual(false)} className="mx-auto block text-xs text-slate-500 hover:text-slate-300">Hide details</button>
                )}
              </>
            )}
            {errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{e}</div>
            ))}

            <div className="flex gap-1 border-b border-white/10 pt-4">
              {tabs.map(([k, label, Icon, badge]) => (
                <button key={k} onClick={() => setTab(k)} className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  <Icon size={15} />{label}
                  {badge === null ? <Loader2 size={12} className="animate-spin text-slate-500" />
                    : badge !== '' && <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums">{badge}</span>}
                  {tab === k && <motion.span layoutId="tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" />}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
                {tab === 'article' && (!out.explainer && !running ? <Failed who="The Explainer" onRetry={() => run(current)} /> : <Article article={out.explainer} research={out.researcher} />)}
                {tab === 'quiz' && (!out.quiz && !running ? <Failed who="The Quiz Master" onRetry={() => run(current)} /> : <Quiz key={current + (out.quiz ? 'q' : 'n')} quiz={out.quiz} />)}
                {tab === 'diagrams' && (!out.diagrammer && !running ? <Failed who="The Diagrammer" onRetry={() => run(current)} /> : <Diagrams key={current} diagrams={out.diagrammer} />)}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </>
  )
}
