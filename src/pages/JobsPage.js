import { useState, useEffect } from "react";
import JobCard from "../components/JobCard";
import PaginationControls from "../components/PaginationControls";
import Modal from "../components/Modal";
import CreateJobForm from "../components/CreateJobForm";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import "./JobsPage.css";

const ITEMS_PER_PAGE = 10;

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || String(active.id) === String(over.id)) {
      return;
    }

    const oldIndex = jobs.findIndex(
      (job) => String(job.id) === String(active.id)
    );
    const newIndex = jobs.findIndex(
      (job) => String(job.id) === String(over.id)
    );

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update the UI
    const updatedJobs = arrayMove(jobs, oldIndex, newIndex);
    const previousJobs = [...jobs];
    setJobs(updatedJobs);

    try {
      const response = await fetch(`/api/jobs/${active.id}/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromOrder: oldIndex,
          toOrder: newIndex,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reorder job");
      }

      setReorderError(null);
    } catch (err) {
      // Rollback on error
      setJobs(previousJobs);
      setReorderError("Failed to reorder job. Please try again.");

      // Clear error after 3 seconds
      setTimeout(() => {
        setReorderError(null);
      }, 3000);
    }
  };

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

      const savedJob = await response.json();

      // Update jobs list optimistically
      setJobs((currentJobs) => {
        if (isEditing) {
          return currentJobs.map((job) =>
            job.id === savedJob.id ? savedJob : job
          );
        }
        return [savedJob, ...currentJobs].slice(0, ITEMS_PER_PAGE);
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

      // Optimistically remove the job from the current view
      setJobs((currentJobs) => currentJobs.filter((j) => j.id !== job.id));

      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update job status");
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
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={jobs.map((job) => String(job.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="jobs-list">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
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
