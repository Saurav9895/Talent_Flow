import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import "./JobCard.css";

function JobCard({ job, onEdit, onArchiveToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(job.id) });
  const isArchived = job.status === "archived";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`job-card ${isArchived ? "archived" : ""} ${
        isDragging ? "dragging" : ""
      }`}
    >
      <div className="job-card-header">
        <div className="job-header-content">
          <h3 className="job-title">
            <Link to={`/jobs/${job.id}`}>{job.title}</Link>
          </h3>
          <span className={`job-status ${job.status}`}>{job.status}</span>
          <span
            className="drag-handle"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            ≡
          </span>
        </div>
        <div className="job-actions">
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
        <span className="job-type">{job.type}</span>
        <span className="job-location">{job.location}</span>
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
