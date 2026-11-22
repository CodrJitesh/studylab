import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Article({ article, research }) {
  if (!article) return <Empty text="The Explainer is writing…" />
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <article className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.markdown}</ReactMarkdown>
      </article>
      <aside className="space-y-5 text-sm">
        {research?.key_concepts?.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold text-slate-300">Key concepts</h3>
            <dl className="space-y-2">
              {research.key_concepts.map((c, i) => (
                <div key={i} className="rounded-lg border border-white/10 p-2">
                  <dt className="font-medium text-indigo-300">{c.term}</dt>
                  <dd className="text-xs text-slate-400">{c.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {research?.sources?.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold text-slate-300">Sources</h3>
            <ul className="space-y-1">
              {research.sources.map((s) => (
                <li key={s.url}><a className="text-indigo-300 hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

export function Empty({ text }) {
  return <div className="py-16 text-center text-slate-500">{text}</div>
}
