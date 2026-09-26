import { ArrowRight, BookOpenCheck, Bot, CalendarClock, ClipboardCheck, Download, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attempt, StudyTask, Syllabus, TestPaper } from '../../shared/contracts/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { useOllamaStatus } from '../hooks/useOllamaStatus';
import { useToastStore } from '../components/feedback/Toast';

export function DashboardPage() {
  const ollama = useOllamaStatus();
  const pushToast = useToastStore((state) => state.push);
  const [backupBusy, setBackupBusy] = useState(false);
  const [syllabus, setSyllabus] = useState<Syllabus>({ paperName: '', topics: [] });
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [tests, setTests] = useState<TestPaper[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  useEffect(() => {
    void Promise.all([
      window.gateHelper.syllabus.get(), window.gateHelper.planner.list(),
      window.gateHelper.tests.list(), window.gateHelper.attempts.list(),
    ]).then(([syllabusValue, taskValues, testValues, attemptValues]) => {
      setSyllabus(syllabusValue); setTasks(taskValues); setTests(testValues); setAttempts(attemptValues);
    }).catch(() => undefined);
  }, []);
  const completedTopics = syllabus.topics.filter((topic) => topic.completed).length;
  const progress = syllabus.topics.length ? Math.round(completedTopics / syllabus.topics.length * 100) : 0;
  const nextTask = [...tasks].filter((task) => !task.completed).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  const latestResult = attempts.find((attempt) => attempt.status === 'submitted');
  const inProgress = attempts.find((attempt) => attempt.status === 'in-progress');
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const runBackup = async (operation: 'export' | 'restore') => {
    setBackupBusy(true);
    try {
      const result = operation === 'export'
        ? await window.gateHelper.app.exportBackup()
        : await window.gateHelper.app.restoreBackup();
      pushToast(result.message);
    } catch (cause) {
      pushToast(cause instanceof Error ? cause.message : `Could not ${operation} backup.`);
    } finally {
      setBackupBusy(false);
    }
  };
  const cards = [
    { icon: BookOpenCheck, eyebrow: 'Syllabus progress', title: syllabus.topics.length ? `${progress}% complete` : 'Choose your GATE paper', description: syllabus.topics.length ? `${completedTopics} of ${syllabus.topics.length} topics completed.` : 'Add your syllabus and track every topic.', link: '/syllabus', label: 'Open syllabus' },
    { icon: CalendarClock, eyebrow: 'Next study task', title: nextTask?.title ?? 'Nothing scheduled yet', description: nextTask ? `${nextTask.scheduledDate} · ${nextTask.durationMinutes} minutes` : 'Create a focused plan for your next session.', link: '/planner', label: 'Open planner' },
    { icon: ClipboardCheck, eyebrow: 'Tests', title: inProgress ? 'Attempt in progress' : `${tests.length} in your library`, description: inProgress ? inProgress.testTitle : tests.length ? 'Review, publish, or start a paper.' : 'Import a PYQ or build a mock test.', link: inProgress ? `/attempt/${inProgress.id}` : '/tests', label: inProgress ? 'Resume attempt' : 'View tests' },
    { icon: RotateCcw, eyebrow: 'Latest result', title: latestResult ? `${latestResult.score} marks` : 'No result yet', description: latestResult ? `${latestResult.correct} correct · ${latestResult.incorrect} incorrect` : 'Completed attempts will create review insights.', link: '/results', label: 'View results' },
  ];
  return <div className="page-stack">
    <PageHeader eyebrow={today} title="Build a calmer path to GATE 2027." description="Plan, practise, review, and understand—kept private on your computer." action={<Link className="button button--primary" to="/planner">Plan a study session <ArrowRight size={16} /></Link>} />
    <section className="dashboard-grid">{cards.map((card) => <article className="overview-card" key={card.eyebrow}><div className="overview-card__top"><div className="overview-card__icon"><card.icon size={20} /></div></div><p className="eyebrow">{card.eyebrow}</p><h2>{card.title}</h2><p>{card.description}</p><Link to={card.link}>{card.label} <ArrowRight size={14} /></Link></article>)}</section>
    <article className="focus-panel"><div className="focus-panel__art"><span className="focus-panel__ring focus-panel__ring--one" /><span className="focus-panel__ring focus-panel__ring--two" /><span className="focus-panel__core"><Bot size={30} /></span></div><div><p className="eyebrow">Private AI study support</p><h2>Your local tutor, when you are ready.</h2><p>Use model knowledge or ground answers in PDFs indexed on this device.</p><div className="focus-panel__footer"><StatusPill status={ollama.data} loading={ollama.loading} /><Link className="text-link" to="/tutor">Open AI Tutor <ArrowRight size={14} /></Link></div></div></article>
    <article className="panel"><div className="section-heading"><div><p className="eyebrow">Data safety</p><h2>Portable local backups</h2><p>Export your database and managed PDFs together, or restore a verified backup. Restore keeps a recovery copy.</p></div><div className="button-row"><button className="button button--secondary" disabled={backupBusy} onClick={() => void runBackup('export')}><Download size={16} /> Export backup</button><button className="button button--secondary" disabled={backupBusy} onClick={() => void runBackup('restore')}><Upload size={16} /> Restore backup</button></div></div></article>
  </div>;
}
