import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import "./CandidateDetail.css";
import CandidatesBoard from "./CandidatesBoard";

// Stage selection removed from candidate detail per request

const DEFAULT_TEAM = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "Recruiter",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@example.com",
    role: "Hiring Manager",
  },
  {
    id: 3,
    name: "Carlos Ruiz",
    email: "carlos@example.com",
    role: "Interviewer",
  },
  { id: 4, name: "Dana Lee", email: "dana@example.com", role: "Recruiter" },
  { id: 5, name: "Eve Chen", email: "eve@example.com", role: "Sourcer" },
];

function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [job, setJob] = useState(null);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [assignedJobWithAssessment, setAssignedJobWithAssessment] =
    useState(null);
  const [submittedAssessments, setSubmittedAssessments] = useState({});
  const [team, setTeam] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentions, setMentions] = useState([]);
  const textareaRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [boardStage, setBoardStage] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/candidates/${id}`);
        if (!res.ok) throw new Error(`Failed to load candidate ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setCandidate(data);

        // prefer assignedJobs on candidate; if any assigned job has an assessment, use it
        try {
          const assigned = Array.isArray(data.assignedJobs)
            ? data.assignedJobs
            : [];
          let found = null;
          if (assigned.length > 0) {
            for (const aj of assigned) {
              try {
                // eslint-disable-next-line no-await-in-loop
                const aRes = await fetch(`/api/assessments/${aj}`);
                if (aRes.ok) {
                  found = aj;

                  // Check for existing submissions
                  const subRes = await fetch(
                    `/api/submissions?candidateId=${id}&jobId=${aj}`
                  );
                  if (subRes.ok) {
                    const submissions = await subRes.json();
                    if (submissions && submissions.length > 0) {
                      if (mounted) {
                        setSubmittedAssessments((prev) => ({
                          ...prev,
                          [aj]: submissions[0],
                        }));
                      }
                    }
                  }

                  // eslint-disable-next-line no-await-in-loop
                  const jRes = await fetch(`/api/jobs/${aj}`);
                  if (jRes.ok) {
                    const jData = await jRes.json();
                    if (mounted) setJob(jData);
                  }
                  if (mounted) setHasAssessment(true);
                  break;
                }
              } catch (e) {
                // ignore individual check errors
              }
            }
          }

          if (found) {
            if (mounted) setAssignedJobWithAssessment(found);
          } else {
            // fallback to latest submission behavior
            const latest = data.submissions && data.submissions[0];
            if (latest && latest.jobId) {
              const jRes = await fetch(`/api/jobs/${latest.jobId}`);
              if (jRes.ok) {
                const jData = await jRes.json();
                if (mounted) setJob(jData);
              }
              try {
                const aRes = await fetch(`/api/assessments/${latest.jobId}`);
                if (mounted) setHasAssessment(aRes.ok);
                if (aRes.ok && mounted) {
                  setAssignedJobWithAssessment(latest.jobId);
                  // also check for existing submissions for this candidate/job
                  try {
                    const subRes = await fetch(
                      `/api/submissions?candidateId=${id}&jobId=${latest.jobId}`
                    );
                    if (subRes.ok) {
                      const submissions = await subRes.json();
                      if (submissions && submissions.length > 0) {
                        if (mounted) {
                          setSubmittedAssessments((prev) => ({
                            ...prev,
                            [latest.jobId]: submissions[0],
                          }));
                        }
                      }
                    }
                  } catch (err) {
                    // ignore
                  }
                }
              } catch (e) {
                if (mounted) setHasAssessment(false);
              }
            }
          }
        } catch (e) {
          // ignore job fetch errors
        }

        const tRes = await fetch(`/api/candidates/${id}/timeline`);
        if (!tRes.ok) throw new Error(`Failed to load timeline ${tRes.status}`);
        const tData = await tRes.json();
        if (!mounted) return;
        setTimeline(tData || []);
        // If submissions were persisted to timeline (legacy or timeline-only flows),
        // detect "Submitted assessment for job <id>" entries and mark those jobs as submitted
        try {
          if (Array.isArray(tData)) {
            const re = /Submitted assessment for job\s*(\d+)/i;
            tData.forEach((entry) => {
              if (entry && entry.note) {
                const m = String(entry.note).match(re);
                if (m) {
                  const jobId = Number(m[1]);
                  if (!Number.isNaN(jobId)) {
                    setSubmittedAssessments((prev) => ({
                      ...prev,
                      [jobId]: entry,
                    }));
                  }
                }
              }
            });
          }
        } catch (err) {
          // non-critical: ignore timeline parsing errors
        }
        // load team members for mention suggestions
        try {
          const teamRes = await fetch(`/api/team`);
          if (teamRes.ok) {
            const teamData = await teamRes.json();
            const fetched = teamData.items || teamData || [];
            // If the DB had existing data and seeding didn't run, fall back to defaults
            if (!fetched || (Array.isArray(fetched) && fetched.length === 0)) {
              if (mounted) setTeam(DEFAULT_TEAM);
            } else {
              if (mounted) setTeam(fetched);
            }
          } else {
            if (mounted) setTeam(DEFAULT_TEAM);
          }
        } catch (e) {
          if (mounted) setTeam(DEFAULT_TEAM);
        }
      } catch (err) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Listen for confirmed stage changes for this candidate and refresh timeline
  useEffect(() => {
    const handler = async (ev) => {
      try {
        const d = ev.detail || {};
        const cid = d.candidateId;
        const confirmed = d.confirmed;
        if (!cid || String(cid) !== String(id)) return;
        if (!confirmed) return; // only refresh on confirmed server updates

        const tRes = await fetch(`/api/candidates/${id}/timeline`);
        if (tRes.ok) {
          const tData = await tRes.json();
          setTimeline(tData || []);
        }
      } catch (e) {
        // ignore timeline refresh errors
      }
    };

    window.addEventListener("candidateStageChanged", handler);
    return () => window.removeEventListener("candidateStageChanged", handler);
  }, [id]);
  const addEntry = async (e) => {
    e.preventDefault();
    try {
      const payload = { note, mentions };
      const res = await fetch(`/api/candidates/${id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to add entry ${res.status}`);
      setMentions([]);
      const newEntry = await res.json();
      setTimeline((t) => [...t, newEntry]);
      setNote("");
      // stage removed from detail UI
    } catch (err) {
      setError(String(err));
    }
  };

  // Helpers for mention suggestions and rendering
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const renderNote = (text, mentionsArray) => {
    if (!text) return null;
    if (mentionsArray && mentionsArray.length > 0) {
      const names = mentionsArray.map((m) => m.name).filter(Boolean);
      if (names.length === 0) return text;
      const pattern = names.map(escapeRegex).join("|");
      const parts = text.split(new RegExp(`(${pattern})`, "g"));
      return parts.map((part, i) => {
        const match = names.find((n) => n === part);
        if (match) {
          const m = mentionsArray.find((x) => x.name === match);
          return (
            <span key={i} className="mention" data-id={m?.id || ""}>
              @{match}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    }

    // Fallback: highlight any @Name-like tokens
    const parts = String(text).split(/(@[\w\s.-]{1,50})/g);
    return parts.map((p, i) =>
      p.startsWith("@") ? (
        <span key={i} className="mention">
          {p}
        </span>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

  const onNoteChange = (e) => {
    const value = e.target.value;
    setNote(value);

    // detect @ query at cursor
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : value.length;
    const upToCursor = value.slice(0, pos);
    const atIndex = upToCursor.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(upToCursor[atIndex - 1]))) {
      const q = upToCursor.slice(atIndex + 1);
      // show suggestions matching q
      const qLower = q.toLowerCase();
      const matches = team.filter(
        (m) =>
          m.name.toLowerCase().includes(qLower) ||
          (m.email || "").toLowerCase().includes(qLower)
      );
      setSuggestions(matches.slice(0, 8));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const onNoteKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const insertMention = (member) => {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : note.length;
    const upToCursor = note.slice(0, pos);
    const atIndex = upToCursor.lastIndexOf("@");
    if (atIndex < 0) return;
    const before = note.slice(0, atIndex);
    const after = note.slice(pos);
    const insertion = `@${member.name} `;
    const newText = before + insertion + after;
    setNote(newText);
    // add to mentions if not already present
    setMentions((prev) => {
      if (prev.some((p) => p.id === member.id)) return prev;
      return [
        ...prev,
        { id: member.id, name: member.name, email: member.email },
      ];
    });
    setShowSuggestions(false);
    // move caret after inserted mention
    requestAnimationFrame(() => {
      if (el) {
        const caret = before.length + insertion.length;
        el.focus();
        el.selectionStart = el.selectionEnd = caret;
      }
    });
  };

  const latestSubmission =
    (candidate && candidate.submissions && candidate.submissions[0]) || null;

  return (
    <div className="candidate-detail">
      <div className="candidate-detail-card">
        <div className="candidate-header">
          <h2>Candidate Profile</h2>
          <Link to="/candidates" className="back-to-list">
            Back to list
          </Link>
        </div>

        {loading && <div className="loading-message">Loading...</div>}
        {error && <div className="error-message">{error}</div>}

        {candidate && (
          <div className="candidate-main">
            <div className="candidate-name">{candidate.name}</div>
            <div className="candidate-email">{candidate.email}</div>

            <div className="candidate-meta">
              <strong>Current stage:</strong>{" "}
              {/* Only show board stage to ensure consistency */}
              {boardStage || "-"}
            </div>

            <div className="applied-jobs-section">
              <h3>Applied Job Roles</h3>

              {candidate.appliedJobs?.length ? (
                <div className="applied-jobs-container">
                  {candidate.appliedJobs.map((job) => (
                    <div key={job.id} className="applied-job-card">
                      <div className="job-info">
                        <span className="job-title">{job.title}</span>
                      </div>

                      <div className="job-actions">
                        {(job.id === assignedJobWithAssessment ||
                          submittedAssessments[job.id]) &&
                          (submittedAssessments[job.id] ? (
                            <>
                              <button className="action-button small" disabled>
                                Take Assessment
                              </button>
                              <span className="assessment-status success">
                                Assessment Submitted
                              </span>
                            </>
                          ) : (
                            <Link
                              to={`/candidates/${id}/assessments/${job.id}`}
                              className="action-button small"
                            >
                              Take Assessment
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-jobs">No job applications yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      {candidate && (
        <>
          <div className="kanban-timeline">
            <div className="kanban-container">
              <h3>Kanban Board</h3>

              <CandidatesBoard
                candidateId={id}
                onStageChange={(s) => setBoardStage(s)}
              />
            </div>

            <div className="timeline-container">
              <h3>Timeline</h3>

              <div className="timeline-list-container">
                {timeline.length === 0 ? (
                  <div className="no-results">No timeline entries</div>
                ) : (
                  <ul className="timeline-list">
                    {timeline.map((t) => (
                      <li key={t.id} className="timeline-entry">
                        <time>{new Date(t.createdAt).toLocaleString()}</time>
                        <div className="note">
                          {renderNote(t.note, t.mentions)}
                        </div>
                        {t.stage && (
                          <div className="stage">Stage: {t.stage}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="form-container">
            <form className="timeline-form" onSubmit={addEntry}>
              <label>
                Note
                <textarea
                  ref={textareaRef}
                  value={note}
                  onChange={onNoteChange}
                  onKeyDown={onNoteKeyDown}
                  rows={3}
                />
              </label>

              {showSuggestions && suggestions.length > 0 && (
                <div className="mentions-suggestions">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="mention-suggestion"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        insertMention(s);
                      }}
                    >
                      {s.name} <span className="muted">{s.role}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-row">
                <button type="submit">Add to timeline</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default CandidateDetail;
