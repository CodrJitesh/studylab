import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Empty } from './Article'

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose', suppressErrorRendering: true })
let counter = 0

function Diagram({ d }) {
  const [svg, setSvg] = useState('')
  const [state, setState] = useState('rendering') // rendering | repairing | ok | failed
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

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{d.title}</h3>
        <span className="text-xs text-slate-500">
          {state === 'repairing' ? '🔧 Diagrammer is repairing…' : d.kind}
        </span>
      </div>
      {state === 'failed'
        ? <pre className="overflow-auto text-xs text-rose-300">Could not render.{'\n\n'}{code.current}</pre>
        : <div className="flex justify-center overflow-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  )
}

export default function Diagrams({ diagrams }) {
  if (!diagrams) return <Empty text="The Diagrammer is drawing…" />
  if (!diagrams.diagrams.length) return <Empty text="No diagrams were generated." />
  return <div className="space-y-5">{diagrams.diagrams.map((d, i) => <Diagram key={i} d={d} />)}</div>
}
