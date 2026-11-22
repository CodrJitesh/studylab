import { Compass, Search, BookOpen, ListChecks, Workflow } from 'lucide-react'

// Static class strings so Tailwind can see them.
export const AGENTS = {
  planner:    { name: 'Planner',     desc: 'Breaks the topic down', Icon: Compass,    text: 'text-sky-300',     bg: 'bg-sky-400/15',     ring: 'ring-sky-400/60',     dot: 'bg-sky-400' },
  researcher: { name: 'Researcher',  desc: 'Reads Wikipedia',       Icon: Search,     text: 'text-emerald-300', bg: 'bg-emerald-400/15', ring: 'ring-emerald-400/60', dot: 'bg-emerald-400' },
  explainer:  { name: 'Explainer',   desc: 'Writes the article',    Icon: BookOpen,   text: 'text-indigo-300',  bg: 'bg-indigo-400/15',  ring: 'ring-indigo-400/60',  dot: 'bg-indigo-400' },
  quiz:       { name: 'Quiz Master', desc: 'Builds the quiz',       Icon: ListChecks, text: 'text-amber-300',   bg: 'bg-amber-400/15',   ring: 'ring-amber-400/60',   dot: 'bg-amber-400' },
  diagrammer: { name: 'Diagrammer',  desc: 'Draws diagrams',        Icon: Workflow,   text: 'text-fuchsia-300', bg: 'bg-fuchsia-400/15', ring: 'ring-fuchsia-400/60', dot: 'bg-fuchsia-400' },
}
