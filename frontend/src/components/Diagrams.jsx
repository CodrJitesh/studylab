import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Copy, Check, Wrench, X } from 'lucide-react'
import { Pending } from './Skeleton'

mermaid.initialize({
  startOnLoad: false, securityLevel: 'loose', suppressErrorRendering: true, theme: 'base',
  themeVariables: {
    background: 'transparent', fontFamily: 'Inter, sans-serif',
    primaryColor: '#25295a', primaryTextColor: '#e6e8ef', primaryBorderColor: '#818cf8',
    secondaryColor: '#3b1f5c', tertiaryColor: '#14213d', lineColor: '#8b93c9',
    noteBkgColor: '#25295a', noteTextColor: '#e6e8ef', actorBkg: '#25295a', actorBorder: '#818cf8',
    actorTextColor: '#e6e8ef', signalColor: '#8b93c9', signalTextColor: '#e6e8ef',
    cScale0: '#3730a3', cScaleLabel0: '#f1f5f9', cScaleInv0: '#3730a3',
    cScale1: '#6d28d9', cScaleLabel1: '#f1f5f9', cScaleInv1: '#6d28d9',
    cScale2: '#0e7490', cScaleLabel2: '#f1f5f9', cScaleInv2: '#0e7490',
    cScale3: '#047857', cScaleLabel3: '#f1f5f9', cScaleInv3: '#047857',
    cScale4: '#a16207', cScaleLabel4: '#f1f5f9', cScaleInv4: '#a16207',
    cScale5: '#be185d', cScaleLabel5: '#f1f5f9', cScaleInv5: '#be185d',
    cScale6: '#1d4ed8', cScaleLabel6: '#f1f5f9', cScaleInv6: '#1d4ed8',
    cScale7: '#7e22ce', cScaleLabel7: '#f1f5f9', cScaleInv7: '#7e22ce',
    cScale8: '#0f766e', cScaleLabel8: '#f1f5f9', cScaleInv8: '#0f766e',
    cScale9: '#b45309', cScaleLabel9: '#f1f5f9', cScaleInv9: '#b45309',
    cScale10: '#9d174d', cScaleLabel10: '#f1f5f9', cScaleInv10: '#9d174d',
    cScale11: '#4338ca', cScaleLabel11: '#f1f5f9', cScaleInv11: '#4338ca',
    git0: '#818cf8', git1: '#e879f9', git2: '#22d3ee', git3: '#34d399',
  },
})
let counter = 0

function Diagram({ d, onExpand }) {
  const [svg, setSvg] = useState('')
  const [state, setState] = useState('rendering') // rendering | repairing | ok | failed
  const [copied, setCopied] = useState(false)
  const code = useRef(d.code)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          await mermaid.parse(code.current)
          const { svg } = await mermaid.render(`m${++counter}`, code.current)
          if (!cancelled) { setSvg(svg); setState('ok') }
          return
        } catch (err) {
          if (attempt === 2 || cancelled) break
          setState('repairing')
          try {
            const r = await fetch('/api/diagram/repair', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: code.current, error: String(err.message || err) }),
            })
            code.current = (await r.json()).code
          } catch { break }
        }
      }
      if (!cancelled) setState('failed')
    })()
    return () => { cancelled = true }
  }, [d])

  const copy = () => { navigator.clipboard?.writeText(code.current); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="font-display text-lg font-semibold">{d.title}</h3>
        <span className="rounded-full bg-fuchsia-400/10 px-2 py-0.5 font-mono text-[10px] text-fuchsia-300">{d.kind}</span>
        <div className="ml-auto flex items-center gap-1 text-slate-400">
          {state === 'repairing' && <span className="mr-2 flex items-center gap-1 text-xs text-amber-300"><Wrench size={13} className="animate-pulse" />Diagrammer is repairing…</span>}
          <button onClick={copy} title="Copy Mermaid code" className="rounded-md p-1.5 hover:bg-white/10 hover:text-white">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          <button onClick={() => svg && onExpand(svg, d.title)} title="Expand" className="rounded-md p-1.5 hover:bg-white/10 hover:text-white"><Maximize2 size={15} /></button>
        </div>
      </div>
      {state === 'failed'
        ? <pre className="overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-rose-300">Could not render this diagram.{'\n\n'}{code.current}</pre>
        : state !== 'ok'
          ? <div className="shimmer h-48" />
          : <div className="flex justify-center overflow-auto py-2 [&_svg]:h-auto [&_svg]:max-h-[520px] [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  )
}

export default function Diagrams({ diagrams }) {
  const [modal, setModal] = useState(null)
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [])
  if (!diagrams) return <Pending who="Diagrammer">is drawing…</Pending>
  if (!diagrams.diagrams.length) return <Pending who="Diagrammer">produced no diagrams.</Pending>
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        {diagrams.diagrams.map((d, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={i === 0 && diagrams.diagrams.length % 2 === 1 ? 'xl:col-span-2' : ''}>
            <Diagram d={d} onExpand={(svg, title) => setModal({ svg, title })} />
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
            <motion.div initial={{ scale: .96 }} animate={{ scale: 1 }} exit={{ scale: .96 }} onClick={(e) => e.stopPropagation()}
              className="glass relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-[#0d1020] p-6">
              <button onClick={() => setModal(null)} className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
              <h3 className="mb-4 font-display text-xl font-semibold">{modal.title}</h3>
              <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: modal.svg }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
