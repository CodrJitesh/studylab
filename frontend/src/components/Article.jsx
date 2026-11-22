import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink, Clock } from 'lucide-react'
import { Pending } from './Skeleton'
import { AGENTS } from '../agents'

const PROSE = `prose prose-invert max-w-none
  prose-headings:font-display prose-headings:tracking-tight
  prose-h1:text-4xl prose-h1:bg-gradient-to-r prose-h1:from-white prose-h1:to-indigo-200 prose-h1:bg-clip-text prose-h1:text-transparent
  prose-h2:mt-10 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2
  prose-a:text-indigo-300 prose-strong:text-white prose-p:leading-relaxed prose-p:text-slate-300
  prose-li:text-slate-300 prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
  prose-th:text-slate-200 prose-td:text-slate-300 prose-hr:border-white/10`

export default function Article({ article, research }) {
  if (!article) return <Pending who="Explainer">is writing the article…</Pending>
  const words = article.markdown.split(/\s+/).length
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="glass rounded-2xl p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
          <Clock size={13} /> {Math.max(1, Math.round(words / 200))} min read · {words} words
        </div>
        <div className={PROSE}><ReactMarkdown remarkPlugins={[remarkGfm]}>{article.markdown}</ReactMarkdown></div>
      </article>
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        {research?.key_concepts?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Key concepts</h3>
            <dl className="space-y-3">
              {research.key_concepts.map((c, i) => (
                <div key={i} className="border-l-2 border-indigo-400/50 pl-3">
                  <dt className="text-sm font-medium text-indigo-200">{c.term}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">{c.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {research?.sources?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${AGENTS.researcher.text}`}>Researched from</h3>
            <ul className="space-y-2">
              {research.sources.map((s) => (
                <li key={s.url}>
                  <a className="group flex items-center justify-between gap-2 text-sm text-slate-300 hover:text-white" href={s.url} target="_blank" rel="noreferrer">
                    <span className="truncate">{s.title}</span>
                    <ExternalLink size={13} className="shrink-0 text-slate-500 group-hover:text-indigo-300" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
