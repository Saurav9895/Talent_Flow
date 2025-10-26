import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AssessmentsPage.css";

function AssessmentsPage() {
  const [assessments, setAssessments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobQuery, setJobQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const jobSelectorRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking/tapping outside the selector
  useEffect(() => {
    if (!showDropdown) return undefined;
    const onDocClick = (e) => {
      if (
        jobSelectorRef.current &&
        !jobSelectorRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [showDropdown]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch both assessments and jobs in parallel. Request a large limit
        // so the dropdown receives all jobs (server paginates with default limit=10).
        const [assessmentsRes, jobsRes] = await Promise.all([
          fetch("/api/assessments"),
          fetch("/api/jobs?limit=1000"),
        ]);

        if (!assessmentsRes.ok) throw new Error("Failed to fetch assessments");
        if (!jobsRes.ok) throw new Error("Failed to fetch jobs");

        const assessmentsData = await assessmentsRes.json();
        const jobsData = await jobsRes.json();

        // Convert jobs array to a map for easy lookup
        const jobsMap = jobsData.items.reduce((acc, job) => {
          acc[job.id] = job;
          return acc;
        }, {});

        // Enrich assessments with job details
        const enrichedAssessments = assessmentsData.items.map((assessment) => ({
          ...assessment,
          job: jobsMap[assessment.jobId],
        }));

        setAssessments(enrichedAssessments);
        setJobs(jobsData.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter assessments based on search query
  const filteredAssessments = assessments.filter((assessment) => {
    const searchString = searchQuery.toLowerCase();
    return (
      assessment.job?.title?.toLowerCase().includes(searchString) ||
      assessment.sections?.some((section) =>
        section.title?.toLowerCase().includes(searchString)
      )
    );
  });

  const getAssessmentStats = (assessment) => {
    const sections = assessment.sections || [];
    const questionCount = sections.reduce(
      (total, section) => total + (section.questions?.length || 0),
      0
    );
    return { sectionCount: sections.length, questionCount };
  };

  if (loading)
    return <div className="loading-message">Loading assessments...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="assessments-page">
      <div className="assessments-header">
        <div>
          <h1>Assessments</h1>
        </div>
        <div>
          <button
            className="action-button primary"
            onClick={() => {
              // Open add panel with no default selection. Do NOT open dropdown here;
              // dropdown should open only when the user clicks the search box.
              setShowAdd(true);
              setSelectedJob(null);
              setJobQuery("");
              setHighlightedIndex(0);
            }}
          >
            Add Assessment
          </button>
        </div>
      </div>

      <div className="assessment-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search assessments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {showAdd && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", marginBottom: 6 }}>
                  Select job to create assessment for
                </label>
                <div className="job-selector" ref={jobSelectorRef}>
                  <div className="job-selector-row">
                    <input
                      className="job-input"
                      placeholder="Search jobs..."
                      value={jobQuery}
                      onChange={(e) => {
                        // Update query but do not force-open dropdown. Dropdown opens on focus/click only.
                        setJobQuery(e.target.value);
                        setHighlightedIndex(0);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onKeyDown={(e) => {
                        const filtered = jobs.filter((j) =>
                          j.title
                            .toLowerCase()
                            .includes((jobQuery || "").toLowerCase())
                        );
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlightedIndex((i) =>
                            Math.min(i + 1, Math.max(0, filtered.length - 1))
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlightedIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const sel = filtered[highlightedIndex];
                          if (sel) {
                            setSelectedJob(sel.id);
                            setJobQuery(sel.title);
                            setShowDropdown(false);
                          }
                        } else if (e.key === "Escape") {
                          setShowDropdown(false);
                        }
                      }}
                    />
                    <div style={{ width: 8 }} />
                    <div className="small-muted">
                      {selectedJob
                        ? `Selected: ${
                            jobs.find((j) => j.id === selectedJob)?.title || ""
                          }`
                        : ""}
                    </div>
                  </div>
                  {showDropdown && (
                    <div className="job-dropdown">
                      {jobs
                        .filter((j) =>
                          j.title
                            .toLowerCase()
                            .includes((jobQuery || "").toLowerCase())
                        )
                        .map((j, idx) => (
                          <div
                            key={j.id}
                            className={`job-item ${
                              idx === highlightedIndex ? "active" : ""
                            }`}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              setSelectedJob(j.id);
                              setJobQuery(j.title);
                              setShowDropdown(false);
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{j.title}</div>
                            <div className="small-muted">
                              {j.location || j.status || ""}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="action-button"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                className="action-button primary"
                onClick={() => {
                  if (selectedJob) {
                    setShowAdd(false);
                    navigate(`/assessments/${selectedJob}/edit`);
                  }
                }}
                disabled={!selectedJob}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredAssessments.length === 0 && (
        <div className="no-assessments">
          <p>No assessments found.</p>
          {jobs.length > 0 && <p>Select a job to create its assessment:</p>}
          <div className="assessment-actions">
            {jobs.map((job) => (
              <Link
                key={job.id}
                to={`/assessments/${job.id}/edit`}
                className="action-button"
              >
                Create for {job.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {filteredAssessments.map((assessment) => {
        const { sectionCount, questionCount } = getAssessmentStats(assessment);
        const lastUpdated = new Date(
          assessment.updatedAt || assessment.createdAt
        ).toLocaleDateString();

        return (
          <div key={assessment.id} className="assessment-card">
            <div className="assessment-card-header">
              <div>
                <h3 className="assessment-title">
                  {assessment.job?.title || "Unnamed Assessment"}
                </h3>
                <div className="assessment-meta">
                  Last updated: {lastUpdated}
                </div>
              </div>
            </div>

            <div className="assessment-info">
              <span className="section-count">
                {sectionCount} {sectionCount === 1 ? "Section" : "Sections"}
              </span>
              <span className="question-count">
                {questionCount} {questionCount === 1 ? "Question" : "Questions"}
              </span>
            </div>

            <div className="assessment-actions">
              <Link
                to={`/assessments/${assessment.jobId}/edit`}
                className="action-button"
              >
                Edit Assessment
              </Link>
              <Link
                to={`/assessments/${assessment.jobId}/view`}
                className="action-button"
              >
                View Assessment
              </Link>
              <Link to={`/jobs/${assessment.jobId}`} className="action-button">
                View Job
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AssessmentsPage;
