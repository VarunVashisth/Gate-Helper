import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AiTutor } from "./routes/AiTutor";
import { Dashboard } from "./routes/Dashboard";
import { NotFound } from "./routes/NotFound";
import { Results } from "./routes/Results";
import { Syllabus } from "./routes/Syllabus";
import { Tests } from "./routes/Tests";

export function App() {
  return <Routes><Route element={<Layout />}><Route index element={<Dashboard />} /><Route path="syllabus" element={<Syllabus />} /><Route path="tests" element={<Tests />} /><Route path="results" element={<Results />} /><Route path="ai-tutor" element={<AiTutor />} /><Route path="*" element={<NotFound />} /></Route></Routes>;
}

