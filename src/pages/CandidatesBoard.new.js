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

// Match stages with the database schema
const STAGES = [
  "applied",
  "screening",
  "phone_screen",
  "interview",
  "offer",
  "hired",
  "rejected",
];

function DraggableCard({ candidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: String(candidate.id),
      data: candidate,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        cursor: "grabbing",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`job-card ${isDragging ? "dragging" : ""}`}
      style={style}
      data-candidate-id={candidate.id}
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
  const [activeId, setActiveId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState(new Map());

  // Configure sensors for responsive drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
        tolerance: 3,
      },
    })
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/candidates?limit=1000`);

      if (!res.ok) {
        throw new Error(`Failed to load candidates: ${res.status}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const data = await res.json();
      const items = data.items || [];

      // Initialize columns
      const cols = {};
      STAGES.forEach((s) => (cols[s] = []));

      // Filter candidates if candidateId is provided
      const filtered = candidateId
        ? items.filter((it) => String(it.id) === String(candidateId))
        : items;

      // Organize candidates into columns
      filtered.forEach((candidate) => {
        const pendingStage = pendingUpdates.get(String(candidate.id));
        let stage = "applied"; // Default stage

        if (pendingStage) {
          stage = pendingStage;
        } else if (candidate.submissions && candidate.submissions.length > 0) {
          const lastSubmission = [...candidate.submissions].sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
          )[0];
          stage = lastSubmission.stage;
        }

        const stageKey = STAGES.includes(stage) ? stage : "applied";
        cols[stageKey].push(candidate);
      });

      setColumns(cols);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Error loading candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    loadData();
  }, [candidateId, pendingUpdates]);

  // Update parent component with stage changes
  useEffect(() => {
    if (!candidateId || typeof onStageChange !== "function") return;

    for (const stage of STAGES) {
      const candidate = (columns[stage] || []).find(
        (c) => String(c.id) === String(candidateId)
      );
      if (candidate) {
        onStageChange(stage);
        return;
      }
    }
    onStageChange(null);
  }, [columns, candidateId, onStageChange]);

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);

    // Find the candidate being dragged
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

  const updateCandidateStage = async (candidateId, newStage) => {
    const res = await fetch(`/api/candidates/${candidateId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update stage: ${res.status}`);
    }

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Invalid response format from server");
    }

    const data = await res.json();
    if (!data || !data.stage) {
      throw new Error("Invalid response data from server");
    }

    return data;
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveDragData(null);

    if (!over || !active) return;

    const candidateId = String(active.id);
    const newStage = String(over.id);

    if (!STAGES.includes(newStage)) {
      console.warn("Invalid stage:", newStage);
      return;
    }

    // Find source stage and candidate
    let sourceStage = null;
    let movingCandidate = null;
    for (const stage of STAGES) {
      const candidate = columns[stage]?.find(
        (c) => String(c.id) === candidateId
      );
      if (candidate) {
        sourceStage = stage;
        movingCandidate = candidate;
        break;
      }
    }

    if (!movingCandidate || sourceStage === newStage) return;

    try {
      // Optimistic update
      setPendingUpdates((prev) => {
        const next = new Map(prev);
        next.set(candidateId, newStage);
        return next;
      });

      // Notify UI of stage change
      window.dispatchEvent(
        new CustomEvent("candidateStageChanged", {
          detail: { candidateId, stage: newStage, confirmed: false },
        })
      );

      // Save current state for rollback
      const previousColumns = JSON.parse(JSON.stringify(columns));

      // Update UI optimistically
      setColumns((current) => {
        const updated = { ...current };
        updated[sourceStage] = current[sourceStage].filter(
          (c) => String(c.id) !== candidateId
        );
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

      // Update server
      await updateCandidateStage(candidateId, newStage);

      // Clear pending state
      setPendingUpdates((prev) => {
        const next = new Map(prev);
        next.delete(candidateId);
        return next;
      });

      // Notify of confirmed change
      window.dispatchEvent(
        new CustomEvent("candidateStageChanged", {
          detail: { candidateId, stage: newStage, confirmed: true },
        })
      );

      // Refresh data
      setTimeout(loadData, 1000);
    } catch (err) {
      console.error("Failed to update stage:", err);

      // Rollback UI
      setColumns(previousColumns);
      setPendingUpdates((prev) => {
        const next = new Map(prev);
        next.delete(candidateId);
        return next;
      });

      // Show error
      setError(err.message);
      setTimeout(() => setError(null), 4000);

      // Notify UI of rollback
      window.dispatchEvent(
        new CustomEvent("candidateStageChanged", {
          detail: {
            candidateId,
            stage: sourceStage,
            confirmed: true,
            error: err.message,
          },
        })
      );

      // Add error animation
      const cardElement = document.querySelector(
        `[data-candidate-id="${candidateId}"]`
      );
      if (cardElement) {
        cardElement.classList.add("error");
        setTimeout(() => cardElement.classList.remove("error"), 1000);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-message">
        <div className="loading-spinner"></div>
        <div>Loading board...</div>
      </div>
    );
  }

  return (
    <div className="jobs-page">
      {error && <div className="error-message">{error}</div>}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveDragData(null);
        }}
      >
        <div className="kanban-board">
          {/* Render columns with 2 per row */}
          {/* {(() => {
            const perRow = 2;
            const rows = Math.ceil(STAGES.length / perRow);
            return Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className="kanban-row">
                {STAGES.slice(rowIndex * perRow, (rowIndex + 1) * perRow).map(stage => (
                  <DroppableColumn key={stage} id={stage} label={stage}>
                    {columns[stage] && columns[stage].map(candidate => (
                      activeId === String(candidate.id) ? null : (
                        <DraggableCard key={candidate.id} candidate={candidate} />
                      )
                    ))}
                  </DroppableColumn>
                ))}
              </div>
            ))}
          })()} */}

          {(() => {
            const perRow = 2;
            const rows = Math.ceil(STAGES.length / perRow);

            return (
              <>
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div key={rowIndex} className="kanban-row">
                    {STAGES.slice(
                      rowIndex * perRow,
                      (rowIndex + 1) * perRow
                    ).map((stage) => (
                      <DroppableColumn key={stage} id={stage} label={stage}>
                        {columns[stage]?.map((candidate) =>
                          activeId === String(candidate.id) ? null : (
                            <DraggableCard
                              key={candidate.id}
                              candidate={candidate}
                            />
                          )
                        )}
                      </DroppableColumn>
                    ))}
                  </div>
                ))}
              </>
            );
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
