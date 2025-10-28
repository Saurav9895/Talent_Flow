import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./JobDetail.css";

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchJob = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (res.status === 404) {
          if (!mounted) return;
          setJob(null);
          setError("not-found");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch job");
        const data = await res.json();
        if (!mounted) return;
        setJob(data);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchJob();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  if (loading) return <div className="loading-message">Loading job...</div>;

  if (error === "not-found") {
    return (
      <div className="job-detail not-found">
        <h2>Job not found</h2>
        <p>The job you're looking for doesn't exist.</p>
        <p>
          <Link to="/jobs">Back to jobs list</Link>
        </p>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  const createdAt = job?.createdAt || job?.postedDate || null;

  return (
    <div className="job-detail">
      <div className="job-detail-header">
        <h1>{job.title}</h1>
        <div className="job-meta">
          <span className={`job-status ${job.status}`}>{job.status}</span>
          {createdAt && (
            <span className="job-created">
              Created: {new Date(createdAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="job-slug">
          Slug: <code>{slugify(job.title)}</code>
        </div>

        {job.skills && job.skills.length > 0 && (
          <div className="job-tags">
            {job.skills.map((s) => (
              <span key={s} className="job-tag">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="job-description">
        <h3>Description</h3>
        <p>{job.description}</p>
      </div>

      <div className="job-extra-info">
        <div className="job-info-card">
          <strong>Applicants:</strong> 34
        </div>
        <div className="job-info-card">
          <strong>Openings:</strong> 2
        </div>
        <div className="job-info-card">
          <strong>Last Updated:</strong> 25 Oct 2025
        </div>
      </div>

      <div className="job-detail-footer">
        <Link to="/jobs">Back to Jobs</Link>
      </div>
    </div>
  );
}

export default JobDetail;
