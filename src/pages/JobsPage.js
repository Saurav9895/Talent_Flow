import { useState, useEffect, useCallback } from "react";
import JobCard from "../components/JobCard";
import PaginationControls from "../components/PaginationControls";
import Modal from "../components/Modal";
import CreateJobForm from "../components/CreateJobForm";
import "./JobsPage.css";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ITEMS_PER_PAGE = 12;

function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reorderError, setReorderError] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch jobs
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          page: page.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          archived: showArchived.toString(),
        });

        if (debouncedQuery) {
          searchParams.set("q", debouncedQuery);
        }

        const response = await fetch(`/api/jobs?${searchParams.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch jobs");
        }

        const data = await response.json();
        setJobs(data.items);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [page, debouncedQuery, showArchived]);

  const handleSaveJob = async (jobData) => {
    setSaving(true);
    try {
      const isEditing = Boolean(selectedJob);
      const url = isEditing ? `/api/jobs/${selectedJob.id}` : "/api/jobs";
      const method = isEditing ? "PATCH" : "POST";

      // Add validation before saving
      if (!jobData.title?.trim()) {
        throw new Error("Job title is required");
      }
      if (!jobData.company?.trim()) {
        throw new Error("Company name is required");
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to ${isEditing ? "update" : "create"} job`
        );
      }

      let savedJob;
      try {
        savedJob = await response.json();
      } catch (err) {
        console.error("Failed to parse response:", err);
        throw new Error("Invalid response from server");
      }

      // Validate the saved job data
      if (!savedJob || !savedJob.id) {
        throw new Error("Invalid job data received from server");
      }

      // Update jobs list optimistically
      setJobs((currentJobs) => {
        if (isEditing) {
          return currentJobs.map((job) =>
            job.id === savedJob.id ? savedJob : job
          );
        }
        const newJobs = [savedJob, ...currentJobs].slice(0, ITEMS_PER_PAGE);
        // Ensure no duplicates
        return newJobs.filter(
          (job, index, self) => index === self.findIndex((j) => j.id === job.id)
        );
      });

      setIsModalOpen(false);
      setSelectedJob(null);

      // Refetch jobs to ensure consistency
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }
      const refreshResponse = await fetch(
        `/api/jobs?${searchParams.toString()}`
      );
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setJobs(refreshData.items);
        setTotalPages(refreshData.totalPages);
      }
    } catch (err) {
      setError(err.message);
      console.error("Save job error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (job) => {
    try {
      const newStatus = job.status === "archived" ? "open" : "archived";

      // Optimistically update the job in the current view (use string-safe compare)
      setJobs((currentJobs) => {
        const updated = currentJobs.map((j) =>
          String(j.id) === String(job.id) ? { ...j, status: newStatus } : j
        );
        // If we're viewing active jobs and the job was archived, remove it from view
        if (!showArchived && newStatus === "archived") {
          return updated.filter((j) => String(j.id) !== String(job.id));
        }
        return updated;
      });

      console.log(`Archiving toggle: job=${job.id} -> ${newStatus}`);

      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const text = await response.text();
      if (!response.ok) {
        // include response body text for debugging
        console.error("Archive toggle failed:", response.status, text);
        let errorData = null;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          // ignore
        }
        throw new Error(
          (errorData && errorData.error) ||
            `Failed to update job status (${response.status})`
        );
      } else {
        console.log("Archive toggle response:", response.status, text);
      }

      // Refresh the jobs list to ensure proper state
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        archived: showArchived.toString(),
      });

      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }

      const refreshResponse = await fetch(
        `/api/jobs?${searchParams.toString()}`
      );
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setJobs(refreshData.items);
        setTotalPages(refreshData.totalPages);
      }
    } catch (err) {
      // If there's an error, refresh the list to ensure correct state
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        archived: showArchived.toString(),
      });

      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }

      const refreshResponse = await fetch(
        `/api/jobs?${searchParams.toString()}`
      );
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setJobs(refreshData.items);
        setTotalPages(refreshData.totalPages);
      }

      setError(err.message);
      console.error("Archive toggle error:", err);
    }
  };

  // --- Drag and drop handlers ---
  const sensors = useSensors(useSensor(PointerSensor));

  const onDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = jobs.findIndex(
        (j) => String(j.id) === String(active.id)
      );
      const newIndex = jobs.findIndex((j) => String(j.id) === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const previous = jobs.slice();
      const next = arrayMove(jobs, oldIndex, newIndex);

      // optimistic update
      setJobs(next);

      try {
        const response = await fetch(`/api/jobs/${active.id}/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromOrder: oldIndex, toOrder: newIndex }),
        });

        if (!response.ok) {
          // rollback
          setJobs(previous);
          const err = await response.text();
          setReorderError(`Failed to reorder jobs: ${err || response.status}`);
          // clear error after a short time
          setTimeout(() => setReorderError(null), 4000);
        } else {
          // success: optionally refresh ordering from server
          // we will keep optimistic state as source of truth for now
        }
      } catch (e) {
        setJobs(previous);
        setReorderError(String(e));
        setTimeout(() => setReorderError(null), 4000);
      }
    },
    [jobs]
  );

  // Sortable wrapper for JobCard
  function SortableJob({ id, job, onEdit, onArchiveToggle }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: String(id) });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    // Pass drag handle props to JobCard so buttons inside the card remain clickable
    const dragHandleProps = {
      ...attributes,
      ...listeners,
      style: { cursor: isDragging ? "grabbing" : "grab" },
    };

    return (
      <div ref={setNodeRef} style={style}>
        <JobCard
          job={job}
          onEdit={onEdit}
          onArchiveToggle={onArchiveToggle}
          dragHandleProps={dragHandleProps}
        />
      </div>
    );
  }

  return (
    <div className="jobs-page">
      <header className="jobs-header">
        <div className="header-left">
          <h1>{showArchived ? "Archived Jobs" : "Active Jobs"}</h1>
          <button
            onClick={() => {
              setSelectedJob(null);
              setIsModalOpen(true);
            }}
            className="create-button"
          >
            Create Job
          </button>
        </div>
        <div className="header-right">
          <div className="filter-container">
            <label className="archive-filter">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {showArchived ? "Show Active Jobs" : "Show Archived Jobs"}
            </label>
          </div>
          <div className="search-container">
            <input
              type="search"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="loading-message">Loading jobs...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="no-results">
          {debouncedQuery
            ? "No jobs found matching your search"
            : "No jobs available"}
        </div>
      ) : (
        <>
          {reorderError && (
            <div className="error-message reorder-error">{reorderError}</div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={jobs.map((j) => String(j.id))}
              strategy={rectSortingStrategy}
            >
              <div className="jobs-list">
                {jobs.map((job) => (
                  <SortableJob
                    key={job.id}
                    id={String(job.id)}
                    job={job}
                    onEdit={() => {
                      setSelectedJob(job);
                      setIsModalOpen(true);
                    }}
                    onArchiveToggle={() => handleArchiveToggle(job)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {!loading && !error && jobs.length > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedJob ? "Edit Job" : "Create New Job"}
      >
        <CreateJobForm
          job={selectedJob}
          onSubmit={handleSaveJob}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedJob(null);
            setError(null);
          }}
          saving={saving}
        />
        {error && <div className="modal-error">{error}</div>}
      </Modal>
    </div>
  );
}

export default JobsPage;
