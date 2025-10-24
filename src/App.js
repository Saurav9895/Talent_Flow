import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import JobsPage from "./pages/JobsPage";
import JobDetail from "./pages/JobDetail";
import CandidatesPage from "./pages/CandidatesPage";
import AssessmentsPage from "./pages/AssessmentsPage";
import { initDB, seedIfEmpty } from "./db/init";

function App() {
  useEffect(() => {
    const setupDB = async () => {
      await initDB();
      await seedIfEmpty({
        jobCount: 15,
        candidateCount: 25,
        assessmentCount: 8,
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
            <Route path="/assessments" element={<AssessmentsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
