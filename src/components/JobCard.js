import { Link } from "react-router-dom";
import "./JobCard.css";

function JobCard({ job, onEdit, onArchiveToggle, dragHandleProps }) {
  const isArchived = job.status === "archived";

  return (
    <div className={`job-card ${isArchived ? "archived" : ""}`}>
      <div className="job-card-header">
        <div className="job-header-content">
          <h3 className="job-title">
            <Link to={`/jobs/${job.id}`}>{job.title}</Link>
          </h3>
          <span className={`job-status ${job.status}`}>{job.status}</span>
        </div>
        <div className="job-actions">
          {/* <button
            {...(dragHandleProps || {})}
            className="drag-handle action-button"
            aria-label="Drag to reorder"
            type="button"
            title="Drag to reorder"
          >
            ⋮
          </button> */}
          <button
            onClick={() => onEdit()}
            className="action-button edit-button"
            title="Edit job"
            type="button"
          >
            Edit
          </button>
          <button
            onClick={() => onArchiveToggle()}
            className="action-button archive-button"
            title={isArchived ? "Unarchive job" : "Archive job"}
            type="button"
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>

      <div className="job-company">{job.company}</div>
      <div className="job-meta">
        <div className="job-desc">
          <span className="job-type">{job.type}</span>
          <span className="job-location">{job.location}</span>
        </div>

        <button
          {...(dragHandleProps || {})}
          className="drag-handle action-button"
          aria-label="Drag to reorder"
          type="button"
          title="Drag to reorder"
        >
          🖐🏻
        </button>
      </div>

      {job.skills && job.skills.length > 0 && (
        <div className="job-tags">
          {job.skills.map((skill) => (
            <span key={skill} className="job-tag">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default JobCard;
