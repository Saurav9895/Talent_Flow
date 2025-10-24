import { useState } from "react";
import "./CreateJobForm.css";

function CreateJobForm({ job, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: job?.title || "",
    description: job?.description || "",
    company: job?.company || "",
    location: job?.location || "",
    type: job?.type || "full-time",
    status: job?.status || "open",
    skills: job?.skills?.join(", ") || "",
  });
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when field is edited
    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!formData.company.trim()) {
      newErrors.company = "Company is required";
    }
    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Convert skills string to array
    const skills = formData.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    // Submit the form with the correct schema
    onSubmit({
      ...formData,
      skills,
      postedDate: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="create-job-form">
      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          className={errors.title ? "error" : ""}
          placeholder="e.g., Senior Frontend Developer"
        />
        {errors.title && <span className="error-message">{errors.title}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="company">Company *</label>
        <input
          id="company"
          name="company"
          type="text"
          value={formData.company}
          onChange={handleChange}
          className={errors.company ? "error" : ""}
          placeholder="Company name"
        />
        {errors.company && (
          <span className="error-message">{errors.company}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="location">Location *</label>
        <input
          id="location"
          name="location"
          type="text"
          value={formData.location}
          onChange={handleChange}
          className={errors.location ? "error" : ""}
          placeholder="e.g., New York, Remote"
        />
        {errors.location && (
          <span className="error-message">{errors.location}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="type">Job Type</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
        >
          <option value="full-time">Full Time</option>
          <option value="part-time">Part Time</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className={errors.description ? "error" : ""}
          placeholder="Job description..."
          rows={4}
        />
        {errors.description && (
          <span className="error-message">{errors.description}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="skills">Skills</label>
        <input
          id="skills"
          name="skills"
          type="text"
          value={formData.skills}
          onChange={handleChange}
          placeholder="react, typescript, node.js"
        />
        <small className="help-text">Separate skills with commas</small>
      </div>

      <div className="form-group">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="button-secondary">
          Cancel
        </button>
        <button type="submit" disabled={checking} className="button-primary">
          {checking ? "Checking..." : job ? "Edit Job" : "Create Job"}
        </button>
      </div>
    </form>
  );
}

export default CreateJobForm;
