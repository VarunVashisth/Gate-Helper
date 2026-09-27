import { Icon } from "../components/Icon";
import { PageIntro } from "../components/PageIntro";

const cards = [
  { label: "Syllabus progress", value: "0%", note: "Import a syllabus to begin", icon: "syllabus" as const },
  { label: "Tests completed", value: "0", note: "Your attempts will appear here", icon: "tests" as const },
  { label: "Average score", value: "—", note: "No scored attempts yet", icon: "results" as const },
];

export function Dashboard() {
  return <><PageIntro eyebrow="Study command center" title="Good to see you." description="Build a clear plan, practise deliberately, and keep every part of your GATE preparation in view." /><section className="stat-grid">{cards.map(card => <article className="stat-card" key={card.label}><div className="stat-icon"><Icon name={card.icon} /></div><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}</section><section className="feature-panel"><div><span className="eyebrow">Start here</span><h2>Turn the official syllabus into a plan you can finish.</h2><p>PDF import and topic tracking arrive in the next implementation phase. The foundation for storing your syllabus is ready.</p></div><div className="decorative-orbit"><span>2027</span></div></section></>;
}

