import { HashRouter, Route, Routes } from 'react-router-dom';
import { ToastViewport } from '../components/feedback/Toast';
import { AppShell } from '../layouts/AppShell';
import { AiTutorPage } from '../pages/AiTutorPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlannerPage } from '../pages/PlannerPage';
import { ResultsPage } from '../pages/ResultsPage';
import { SyllabusPage } from '../pages/SyllabusPage';
import { TestsPage } from '../pages/TestsPage';
import { TestEditorPage } from '../pages/TestEditorPage';
import { TestRunnerPage } from '../pages/TestRunnerPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="syllabus" element={<SyllabusPage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="tests/new" element={<TestEditorPage />} />
          <Route path="tests/:testId/edit" element={<TestEditorPage />} />
          <Route path="attempt/:attemptId" element={<TestRunnerPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="tutor" element={<AiTutorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ToastViewport />
    </HashRouter>
  );
}
