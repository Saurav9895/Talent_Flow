import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./AssessmentBuilder.css";

function AssessmentViewer() {
  const { jobId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [aRes, jRes] = await Promise.all([
          fetch(`/api/assessments/${jobId}`),
          fetch(`/api/jobs/${jobId}`),
        ]);
        if (!aRes.ok && aRes.status !== 404)
          throw new Error("Failed to load assessment");
        if (!jRes.ok) throw new Error("Failed to load job");

        const aData = aRes.ok ? await aRes.json() : null;
        const jData = await jRes.json();
        if (!mounted) return;
        setAssessment(aData);
        setJob(jData);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  if (loading)
    return <div className="loading-message">Loading assessment...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  const sections = assessment?.sections || [];

  return (
    <div className="assessments-page">
      <div className="assessments-header">
        <div>
          <h1>View Assessment</h1>
          <h2>{job?.title}</h2>
        </div>
        <div className="actions">
          <Link to="/assessments" className="action-button">
            Back to Assessments
          </Link>
          <Link
            to={`/assessments/${jobId}/edit`}
            className="action-button primary"
          >
            Edit
          </Link>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="no-assessments">
          No assessment configured for this job.
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.id} className="section-card">
            <div className="section-header">
              <div>
                <div className="section-title">{section.title}</div>
                {section.description && (
                  <div className="preview-muted">{section.description}</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {(section.questions || []).map((q) => (
                <div key={q.id} className="preview-question">
                  <label>{q.text || "(no text)"}</label>
                  <div className="preview-muted" style={{ marginTop: 6 }}>
                    {q.type === "single-choice" && (
                      <div>
                        {(q.options || []).map((o, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            ○ {o || `Option ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === "multi-choice" && (
                      <div>
                        {(q.options || []).map((o, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            □ {o || `Option ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === "short-text" && <div>Short text answer</div>}
                    {q.type === "long-text" && <div>Long text answer</div>}
                    {q.type === "numeric" && (
                      <div>
                        Numeric ({q.min} - {q.max})
                      </div>
                    )}
                    {q.type === "file-upload" && (
                      <div>
                        File upload (allowed: {q.allowedTypes || "any"})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default AssessmentViewer;
