import { Link } from "react-router-dom";
import Card from "./Card";
import "./JobCard.css";

function JobCard({ job, onEdit, onArchiveToggle, dragHandleProps }) {
  const isArchived = job.status === "archived";

  const cardHeader = (
    <div className="job-card-header">
      <div className="job-header-content">
        <h3 className="job-title">
          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
        </h3>
        <span className={`job-status ${job.status}`}>{job.status}</span>
      </div>
      <div className="job-actions">
        <button
          onClick={() => onEdit()}
          className="button action-button"
          title="Edit job"
          type="button"
        >
          Edit
        </button>
        <button
          onClick={() => onArchiveToggle()}
          className="button action-button"
          title={isArchived ? "Unarchive job" : "Archive job"}
          type="button"
        >
          {isArchived ? "Unarchive" : "Archive"}
        </button>
      </div>
    </div>
  );

  const cardFooter = (
    <div className="job-card-footer">
      <div className="job-meta">
        <span className="job-type">{job.type}</span>
        <span className="job-location">{job.location}</span>
        <button
          {...(dragHandleProps || {})}
          className="drag-handle"
          aria-label="Drag to reorder"
          type="button"
          title="Drag to reorder"
        >
          ☰
        </button>
      </div>
      {job.skills && job.skills.length > 0 && (
        <div className="job-tags">
          {job.skills.map((skill) => (
            <span key={skill} className="tag">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card
      className={`job-card ${isArchived ? "archived" : ""}`}
      title={cardHeader}
      subtitle={job.company}
      footer={cardFooter}
    />
  );
}

export default JobCard;
