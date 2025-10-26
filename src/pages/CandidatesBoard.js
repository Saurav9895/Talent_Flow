import React, { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import "./CandidatesPage.css";
import "../components/JobCard.css";
import "../components/KanbanBoard.css";

const STAGES = ["applied", "screen", "tech", "offer", "hired", "rejected"];

function DraggableCard({ candidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: String(candidate.id),
      data: { candidate },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        cursor: "grabbing",
        opacity: isDragging ? "0.5" : "1",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`job-card ${isDragging ? "dragging" : ""}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="job-card-header">
        <div className="job-header-content">
          <div>
            <div className="job-title">{candidate.name}</div>
            <div className="job-company">{candidate.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ id, children, label }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div className="kanban-column" ref={setNodeRef}>
      <div className="kanban-column-header">{label}</div>
      <div className={`kanban-column-body ${isOver ? "over" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function CandidatesBoard({ candidateId = null, onStageChange = null }) {
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState(new Map()); // Track pending stage updates

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
        delay: 0,
      },
    })
  );

  // Method to update a candidate's stage (PATCH /candidates/:id)
  const updateCandidateStage = async (candidateId, newStage) => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        let errMsg = `Failed to update stage (${res.status})`;
        try {
          const body = await res.json();
          if (body && body.error) errMsg = body.error;
        } catch (e) {
          // ignore parse errors
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!data || !data.stage) {
        throw new Error("Invalid response from server");
      }

      return data;
    } catch (err) {
      console.error("Stage update error:", err);
      throw err;
    }
  };

  const loadDataWithPending = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates?limit=1000`);
      const data = await res.json();
      const items = data.items || [];
      const cols = {};
      STAGES.forEach((s) => (cols[s] = []));
      const filtered = candidateId
        ? items.filter((it) => String(it.id) === String(candidateId))
        : items;

      filtered.forEach((c) => {
        // Get stage from pending updates first
        const pendingStage = pendingUpdates.get(String(c.id));
        let stage = "applied"; // Default stage

        if (pendingStage) {
          stage = pendingStage;
        } else if (
          c.submissions &&
          Array.isArray(c.submissions) &&
          c.submissions.length > 0
        ) {
          // Get stage from most recent submission
          const lastSubmission = [...c.submissions].sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
          )[0];
          stage = lastSubmission.stage;
        }

        // Ensure stage is valid
        const stageKey = STAGES.includes(stage) ? stage : "applied";
        cols[stageKey].push(c);
      });

      // Only update if there are actual changes
      const hasChanges = STAGES.some((stage) => {
        const currentCol = columns[stage] || [];
        const newCol = cols[stage] || [];
        return (
          currentCol.length !== newCol.length ||
          newCol.some(
            (c, i) =>
              currentCol[i]?.id !== c.id ||
              currentCol[i]?.submissions?.[0]?.stage !==
                c.submissions?.[0]?.stage
          )
        );
      });

      if (hasChanges) {
        setColumns(cols);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [candidateId, pendingUpdates, columns]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadDataWithPending();
  }, [loadDataWithPending]);

  // Whenever columns change, if a candidateId prop was provided, report
  // which column/stage the candidate is currently in via onStageChange
  useEffect(() => {
    if (!candidateId || typeof onStageChange !== "function") return;
    for (const s of STAGES) {
      const candidate = (columns[s] || []).find(
        (c) => String(c.id) === String(candidateId)
      );
      if (candidate) {
        try {
          onStageChange(s);
        } catch (e) {
          // swallow callback errors
        }
        return;
      }
    }
    // not found
    try {
      onStageChange(null);
    } catch (e) {
      // ignore
    }
  }, [columns, candidateId, onStageChange]);

  // Setup polling with a longer interval and skip if there are pending updates
  useEffect(() => {
    if (pendingUpdates.size > 0) {
      return; // Skip polling if there are pending updates
    }

    const intervalId = setInterval(() => {
      loadDataWithPending();
    }, 10000); // Poll every 10 seconds instead of 5

    return () => clearInterval(intervalId);
  }, [loadDataWithPending, pendingUpdates]);

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);

    for (const stage of STAGES) {
      const candidate = columns[stage]?.find(
        (c) => String(c.id) === String(active.id)
      );
      if (candidate) {
        setActiveDragData(candidate);
        break;
      }
    }
  };

  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      setActiveDragData(null);
      return;
    }

    const candidateId = String(active.id);
    const newStage = String(over.id);

    // Find the candidate and their current stage
    let sourceStage = null;
    let movingCandidate = null;
    for (const s of STAGES) {
      const candidate = columns[s]?.find((c) => String(c.id) === candidateId);
      if (candidate) {
        sourceStage = s;
        movingCandidate = candidate;
        break;
      }
    }

    // Validate the drag operation
    if (!movingCandidate || sourceStage === newStage) {
      setActiveId(null);
      setActiveDragData(null);
      return;
    }

    setActiveId(null);
    setActiveDragData(null);

    // Optimistic update: mark pending and move candidate locally
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(candidateId, newStage);
      return next;
    });

    // Dispatch an optimistic stage change event so other parts of the UI can update immediately
    try {
      window.dispatchEvent(
        new CustomEvent("candidateStageChanged", {
          detail: { candidateId, stage: newStage, confirmed: false },
        })
      );
    } catch (e) {
      // ignore if window isn't available (e.g., server-side)
    }

    const previousColumns = JSON.parse(JSON.stringify(columns));

    setColumns((current) => {
      const updated = { ...current };
      updated[sourceStage] = current[sourceStage].filter(
        (c) => String(c.id) !== candidateId
      );
      updated[newStage] = [
        ...current[newStage],
        {
          ...movingCandidate,
          submissions: [{ ...movingCandidate.submissions[0], stage: newStage }],
        },
      ];
      return updated;
    });

    try {
      const result = await updateCandidateStage(candidateId, newStage);

      if (!result) {
        throw new Error("No response from server");
      }

      // Update local state with the result
      setColumns((current) => {
        const updated = { ...current };
        // Remove from old column
        if (sourceStage) {
          updated[sourceStage] = current[sourceStage].filter(
            (c) => String(c.id) !== candidateId
          );
        }
        // Add to new column with updated submission
        updated[newStage] = [
          ...current[newStage],
          {
            ...movingCandidate,
            submissions: [
              {
                ...movingCandidate.submissions[0],
                stage: newStage,
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        ];
        return updated;
      });

      // Success: remove pending marker
      setPendingUpdates((prev) => {
        const next = new Map(prev);
        next.delete(candidateId);
        return next;
      });

      // Broadcast confirmed stage change so other UI parts (cards, detail/timeline)
      // can refresh in response to a server-confirmed update.
      try {
        window.dispatchEvent(
          new CustomEvent("candidateStageChanged", {
            detail: { candidateId, stage: newStage, confirmed: true },
          })
        );
      } catch (e) {
        // ignore (e.g., server-side rendering)
      }

      // Schedule a delayed refresh to ensure consistency
      setTimeout(() => {
        loadDataWithPending();
      }, 2000);
    } catch (err) {
      // rollback
      console.error("Error updating candidate stage:", err);
      setColumns(previousColumns);
      setPendingUpdates((prev) => {
        const next = new Map(prev);
        next.delete(candidateId);
        return next;
      });
      setError(`Failed to update candidate stage: ${err.message}`);
      setTimeout(() => setError(null), 4000);
    }
  };

  if (loading)
    return (
      <div className="loading-message">
        <div className="loading-spinner"></div>
        <div>Loading board...</div>
      </div>
    );

  return (
    <div className="jobs-page">
      {/* <h2>Candidates Board</h2> */}
      {error && <div className="error-message">{error}</div>}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveDragData(null);
        }}
        /* no modifiers configured to keep the dependency surface small */
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up candidate`,
            onDragOver: ({ active, over }) =>
              over
                ? `Moving candidate to ${over.id} column`
                : `Moving candidate`,
            onDragEnd: ({ active, over }) =>
              over
                ? `Placed candidate in ${over.id} column`
                : `Dropped candidate`,
          },
        }}
      >
        <div className="kanban-board">
          {/* Render columns with 2 per row */}
          {(() => {
            const perRow = 2;
            const rows = Math.ceil(STAGES.length / perRow);
            return Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className="kanban-row">
                {STAGES.slice(rowIndex * perRow, (rowIndex + 1) * perRow).map(
                  (s) => (
                    <DroppableColumn key={s} id={s} label={s}>
                      {columns[s] &&
                        columns[s].map((c) =>
                          activeId === String(c.id) ? null : (
                            <DraggableCard key={c.id} candidate={c} />
                          )
                        )}
                    </DroppableColumn>
                  )
                )}
              </div>
            ));
          })()}
        </div>

        <DragOverlay>
          {activeDragData ? (
            <div className="job-card dragging">
              <div className="job-card-header">
                <div className="job-header-content">
                  <div>
                    <div className="job-title">{activeDragData.name}</div>
                    <div className="job-company">{activeDragData.email}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default CandidatesBoard;
