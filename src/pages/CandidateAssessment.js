import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "./AssessmentBuilder.css";

const QUESTION_TYPES = {
  SINGLE_CHOICE: "single-choice",
  MULTI_CHOICE: "multi-choice",
  SHORT_TEXT: "short-text",
  LONG_TEXT: "long-text",
  NUMERIC: "numeric",
  FILE_UPLOAD: "file-upload",
};

function CandidateAssessment() {
  const { id: candidateIdParam, jobId } = useParams();
  const candidateId = Number(candidateIdParam);
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [jRes, aRes] = await Promise.all([
          fetch(`/api/jobs/${jobId}`),
          fetch(`/api/assessments/${jobId}`),
        ]);
        if (!jRes.ok) throw new Error("Failed to load job");
        const jData = await jRes.json();
        const aData = aRes.ok ? await aRes.json() : null;
        if (!mounted) return;
        setJob(jData);
        setAssessment(aData);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => (mounted = false);
  }, [jobId]);

  useEffect(() => {
    // Try to restore in-progress answers from localStorage first, otherwise reset
    const draftKey = `assessment-answers-${candidateId}-${jobId}`;
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setAnswers(parsed || {});
      } else {
        setAnswers({});
      }
    } catch (e) {
      setAnswers({});
    }
    setErrors({});
    setSuccess(null);
    setError(null);
  }, [assessment, candidateId, jobId]);

  const handleAnswer = (questionId, value) => {
    setAnswers((s) => {
      const next = { ...s, [questionId]: value };
      // persist draft to localStorage
      try {
        const draftKey = `assessment-answers-${candidateId}-${jobId}`;
        localStorage.setItem(draftKey, JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const isVisible = (question) => {
    const cond = question.condition;
    if (!cond || !cond.questionId) return true;
    const qid = String(cond.questionId);
    const actual = answers[qid];
    const expected = cond.value;
    if (Array.isArray(actual)) return actual.includes(expected);
    return String(actual) === String(expected);
  };

  const validate = () => {
    const newErrors = {};
    (assessment?.sections || []).forEach((section) => {
      (section.questions || []).forEach((q) => {
        if (!isVisible(q)) return;
        const qid = String(q.id);
        const val = answers[qid];
        if (q.required) {
          if (
            val === undefined ||
            val === null ||
            (typeof val === "string" && val.trim() === "") ||
            (Array.isArray(val) && val.length === 0)
          ) {
            newErrors[qid] = "This question is required";
            return;
          }
        }
        if (
          (q.type === QUESTION_TYPES.SHORT_TEXT ||
            q.type === QUESTION_TYPES.LONG_TEXT) &&
          q.maxLength &&
          q.maxLength > 0
        ) {
          if (val && String(val).length > q.maxLength) {
            newErrors[qid] = `Maximum length is ${q.maxLength}`;
            return;
          }
        }
        if (q.type === QUESTION_TYPES.NUMERIC) {
          if (val !== "" && val !== undefined && val !== null) {
            const num = Number(val);
            if (!Number.isNaN(q.min) && num < q.min)
              newErrors[qid] = `Minimum is ${q.min}`;
            if (!Number.isNaN(q.max) && num > q.max)
              newErrors[qid] = `Maximum is ${q.max}`;
          }
        }
      });
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const ok = validate();
    if (!ok) return;
    setSubmitting(true);
    try {
      const payload = {
        candidateId,
        answers,
        assessmentId: assessment?.id || null,
      };
      const res = await fetch(`/api/assessments/${jobId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit assessment");
      const data = await res.json();
      setSuccess(data);
      // clear local draft on successful submit
      try {
        const draftKey = `assessment-answers-${candidateId}-${jobId}`;
        localStorage.removeItem(draftKey);
      } catch (e) {
        // ignore
      }
      // optional: navigate back to candidate detail after a short delay
      setTimeout(() => {
        navigate(`/candidates/${candidateId}`);
      }, 1200);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return <div className="loading-message">Loading assessment...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  const sections = assessment?.sections || [];

  return (
    <div className="assessments-page">
      <div className="assessments-header">
        <div>
          <h1>Assessment</h1>
          <h2>{job?.title}</h2>
        </div>
        <div className="actions">
          <Link to={`/candidates/${candidateId}`} className="action-button">
            Back
          </Link>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="no-assessments">
          No assessment configured for this job.
        </div>
      ) : (
        <form className="preview-form" onSubmit={handleSubmit}>
          {(sections || []).map((section) => (
            <div key={section.id} className="preview-section">
              <div>
                <strong>{section.title || "Untitled Section"}</strong>
                {section.description && (
                  <div className="preview-muted">{section.description}</div>
                )}
              </div>
              <div>
                {(section.questions || []).map((q) => {
                  if (!isVisible(q)) return null;
                  const qid = String(q.id);
                  const val = answers[qid];
                  const err = errors[qid];
                  switch (q.type) {
                    case QUESTION_TYPES.SINGLE_CHOICE:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          {(q.options || []).map((opt, i) => (
                            <div key={i}>
                              <label>
                                <input
                                  type="radio"
                                  name={`q-${qid}`}
                                  checked={val === opt}
                                  onChange={() => handleAnswer(qid, opt)}
                                />{" "}
                                {opt || `Option ${i + 1}`}
                              </label>
                            </div>
                          ))}
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    case QUESTION_TYPES.MULTI_CHOICE:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          {(q.options || []).map((opt, i) => {
                            const selected =
                              Array.isArray(val) && val.includes(opt);
                            return (
                              <div key={i}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={!!selected}
                                    onChange={() => {
                                      const prev = Array.isArray(val)
                                        ? val.slice()
                                        : [];
                                      const idx = prev.indexOf(opt);
                                      if (idx === -1) prev.push(opt);
                                      else prev.splice(idx, 1);
                                      handleAnswer(qid, prev);
                                    }}
                                  />{" "}
                                  {opt || `Option ${i + 1}`}
                                </label>
                              </div>
                            );
                          })}
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    case QUESTION_TYPES.SHORT_TEXT:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          <input
                            type="text"
                            value={val || ""}
                            onChange={(e) => handleAnswer(qid, e.target.value)}
                          />
                          {q.maxLength > 0 && (
                            <div className="preview-muted">
                              {String(val || "").length}/{q.maxLength}
                            </div>
                          )}
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    case QUESTION_TYPES.LONG_TEXT:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          <textarea
                            value={val || ""}
                            onChange={(e) => handleAnswer(qid, e.target.value)}
                          />
                          {q.maxLength > 0 && (
                            <div className="preview-muted">
                              {String(val || "").length}/{q.maxLength}
                            </div>
                          )}
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    case QUESTION_TYPES.NUMERIC:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          <input
                            type="number"
                            min={q.min}
                            max={q.max}
                            value={val || ""}
                            onChange={(e) =>
                              handleAnswer(
                                qid,
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                          />
                          <div className="preview-muted">
                            Min: {q.min} · Max: {q.max}
                          </div>
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    case QUESTION_TYPES.FILE_UPLOAD:
                      return (
                        <div className="preview-question" key={qid}>
                          <label>{q.text || "(no text)"}</label>
                          <input
                            type="file"
                            onChange={(e) =>
                              handleAnswer(
                                qid,
                                e.target.files && e.target.files[0]
                              )
                            }
                          />
                          <div className="preview-muted">
                            Allowed: {q.allowedTypes || "any"}
                          </div>
                          {err && (
                            <div style={{ color: "#d73a49", marginTop: 6 }}>
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Assessment"}
            </button>
            {success && (
              <span style={{ marginLeft: 12, color: "green" }}>
                Submitted ✓
              </span>
            )}
            {error && (
              <div style={{ color: "#d73a49", marginTop: 8 }}>{error}</div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default CandidateAssessment;
