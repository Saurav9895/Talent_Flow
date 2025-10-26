import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import JobsPage from "./pages/JobsPage";
import JobDetail from "./pages/JobDetail";
import CandidatesPage from "./pages/CandidatesPage";
import CandidateDetail from "./pages/CandidateDetail";
import AssessmentsPage from "./pages/AssessmentsPage";
import AssessmentBuilder from "./pages/AssessmentBuilder";
import AssessmentViewer from "./pages/AssessmentViewer";
import CandidateAssessment from "./pages/CandidateAssessment";
import { initDB, seedIfEmpty } from "./db/init";

function App() {
  useEffect(() => {
    const setupDB = async () => {
      await initDB();
      await seedIfEmpty({
        jobCount: 15,
        candidateCount: 1000,
        assessmentCount: 0, // Set to 0 to prevent auto-seeding of assessments
      });
    };

    setupDB().catch(console.error);
  }, []);
  return (
    <BrowserRouter>
      <div className="App">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/:id" element={<CandidateDetail />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
            <Route
              path="/assessments/:jobId/edit"
              element={<AssessmentBuilder />}
            />
            <Route
              path="/assessments/:jobId/view"
              element={<AssessmentViewer />}
            />
            <Route
              path="/candidates/:id/assessments/:jobId"
              element={<CandidateAssessment />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
