import React, { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import "../components/KanbanBoard.css";
import "../components/JobCard.css";

const STAGES = ["applied", "screen", "tech", "offer", "hired", "rejected"];

function DraggableCard({ candidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: String(candidate.id), data: { candidate } });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
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

function DroppableColumn({ id, label, children }) {
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

export default function CandidatesBoard({
  candidateId = null,
  onStageChange = null,
}) {
  const [columns, setColumns] = useState(() => {
    const c = {};
    STAGES.forEach((s) => (c[s] = []));
    return c;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates?limit=1000`);
      if (!res.ok) throw new Error(`Failed to load candidates (${res.status})`);
      const contentType = res.headers.get("content-type") || "";
      let body = null;
      if (contentType.includes("application/json")) body = await res.json();
      else throw new Error("Invalid content-type from server");

      const items = Array.isArray(body.items) ? body.items : body.items || body;
      const cols = {};
      STAGES.forEach((s) => (cols[s] = []));

      (items || []).forEach((c) => {
        // determine stage: prefer candidate.stage, then latest submission
        let stage =
          c.stage ||
          (c.submissions && c.submissions[0] && c.submissions[0].stage) ||
          "applied";
        if (!STAGES.includes(stage)) stage = "applied";
        cols[stage].push(c);
      });

      setColumns(cols);
      setError(null);

      // If a candidateId was provided, notify parent of its current stage
      if (candidateId && typeof onStageChange === "function") {
        let foundStage = null;
        for (const s of STAGES) {
          if (
            (cols[s] || []).some((c) => String(c.id) === String(candidateId))
          ) {
            foundStage = s;
            break;
          }
        }
        try {
          onStageChange(foundStage);
        } catch (e) {
          // ignore callback errors
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [candidateId, onStageChange]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const onDragStart = ({ active }) => {
    const id = String(active.id);
    // find candidate
    for (const s of STAGES) {
      const found = columns[s]?.find((c) => String(c.id) === id);
      if (found) {
        setActiveDragData(found);
        break;
      }
    }
  };

  const getStageForCandidate = (id) => {
    for (const s of STAGES) {
      if ((columns[s] || []).some((c) => String(c.id) === String(id))) return s;
    }
    return null;
  };

  const postTimelineEntry = async (candidateId, stage) => {
    try {
      const payload = { note: `Stage changed to ${stage}`, stage };
      const res = await fetch(`/api/candidates/${candidateId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
      return null;
    } catch (e) {
      return null;
    }
  };

  const changeStage = async (newStage) => {
    if (!candidateId) return;
    const candidateIdStr = String(candidateId);
    const sourceStage = getStageForCandidate(candidateIdStr);
    if (!sourceStage || sourceStage === newStage) return;

    const previous = JSON.parse(JSON.stringify(columns));

    // optimistic move
    setColumns((cur) => {
      const next = {};
      STAGES.forEach((s) => (next[s] = [...(cur[s] || [])]));
      next[sourceStage] = next[sourceStage].filter(
        (c) => String(c.id) !== candidateIdStr
      );
      const moving = (cur[sourceStage] || []).find(
        (c) => String(c.id) === candidateIdStr
      );
      if (moving) {
        next[newStage] = [...next[newStage], { ...moving, stage: newStage }];
      }
      return next;
    });

    try {
      // optimistic event
      try {
        window.dispatchEvent(
          new CustomEvent("candidateStageChanged", {
            detail: {
              candidateId: candidateIdStr,
              stage: newStage,
              confirmed: false,
            },
          })
        );
      } catch (e) {}

      await updateStageOnServer(candidateIdStr, newStage);

      try {
        window.dispatchEvent(
          new CustomEvent("candidateStageChanged", {
            detail: {
              candidateId: candidateIdStr,
              stage: newStage,
              confirmed: true,
            },
          })
        );
      } catch (e) {}

      if (typeof onStageChange === "function") {
        try {
          onStageChange(newStage);
        } catch (e) {}
      }
    } catch (err) {
      setColumns(previous);
      setError(String(err));
      setTimeout(() => setError(null), 4000);
    }
  };

  const updateStageOnServer = async (candidateId, newStage) => {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });

    if (!res.ok) {
      // attempt to read error message
      let msg = `Server returned ${res.status}`;
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await res.json();
          if (j && j.error) msg = j.error;
        } else {
          const t = await res.text();
          if (t) msg = t.slice(0, 200);
        }
      } catch (e) {
        // ignore
      }
      throw new Error(msg);
    }

    // if JSON returned, return it; otherwise return null
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
    } catch (e) {
      // ignore parse error
    }
    return null;
  };

  const onDragEnd = async ({ active, over }) => {
    setActiveDragData(null);
    if (!active || !over) return;
    const candidateId = String(active.id);
    const newStage = String(over.id);
    if (!STAGES.includes(newStage)) return;

    // find source stage
    let sourceStage = null;
    for (const s of STAGES) {
      if ((columns[s] || []).some((c) => String(c.id) === candidateId)) {
        sourceStage = s;
        break;
      }
    }
    if (!sourceStage || sourceStage === newStage) return;

    // optimistic update
    const previous = JSON.parse(JSON.stringify(columns));
    setColumns((cur) => {
      const next = {};
      STAGES.forEach((s) => (next[s] = [...(cur[s] || [])]));
      // remove from source
      next[sourceStage] = next[sourceStage].filter(
        (c) => String(c.id) !== candidateId
      );
      // move to target (append)
      const moving = (cur[sourceStage] || []).find(
        (c) => String(c.id) === candidateId
      );
      if (moving) {
        const moved = { ...moving, stage: newStage };
        next[newStage] = [...next[newStage], moved];
      }
      return next;
    });

    // emit optimistic event
    try {
      window.dispatchEvent(
        new CustomEvent("candidateStageChanged", {
          detail: { candidateId, stage: newStage, confirmed: false },
        })
      );
    } catch (e) {
      // ignore
    }

    try {
      await updateStageOnServer(candidateId, newStage);

      // confirmed: emit confirmed event
      try {
        window.dispatchEvent(
          new CustomEvent("candidateStageChanged", {
            detail: { candidateId, stage: newStage, confirmed: true },
          })
        );
      } catch (e) {
        // ignore
      }
      // notify parent callback, if provided
      if (typeof onStageChange === "function") {
        try {
          onStageChange(newStage);
        } catch (e) {
          // ignore
        }
      }

      // add timeline entry on server (best-effort)
      try {
        postTimelineEntry(candidateId, newStage);
      } catch (e) {
        // ignore timeline errors
      }
    } catch (err) {
      // rollback
      setColumns(previous);
      setError(String(err));
      setTimeout(() => setError(null), 4000);
    }
  };

  if (loading)
    return (
      <div className="loading-message">
        <div className="loading-spinner" />
        <div>Loading board...</div>
      </div>
    );

  return (
    <div className="kanban-board">
      {error && <div className="error-message">{error}</div>}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragData(null)}
      >
        {(() => {
          const perRow = 2;
          const rows = Math.ceil(STAGES.length / perRow);
          return Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="kanban-row">
              {STAGES.slice(rowIndex * perRow, (rowIndex + 1) * perRow).map(
                (s) => (
                  <DroppableColumn key={s} id={s} label={s}>
                    {candidateId
                      ? (columns[s] || [])
                          .filter((c) => String(c.id) === String(candidateId))
                          .map((c) => (
                            <DraggableCard key={c.id} candidate={c} />
                          ))
                      : (columns[s] || []).map((c) => (
                          <DraggableCard key={c.id} candidate={c} />
                        ))}
                  </DroppableColumn>
                )
              )}
            </div>
          ));
        })()}

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
