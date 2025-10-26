import React, { useEffect, useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { Link, useNavigate } from "react-router-dom";
import "./CandidatesPage.css"; // page-specific styles
import "../components/JobCard.css"; // reuse job card styles for identical look
import PaginationControls from "../components/PaginationControls";
// Polling disabled: removed usePolling import to stop automatic refreshes

const STAGES = [
  "all",
  "applied",
  "screening",
  "phone_screen",
  "interview",
  "offer",
  "hired",
  "rejected",
];

// Options used by inline card stage editor. This is a superset to accommodate
// stage names used by different parts of the app (board/init). Adjust if you
// canonicalize stage keys elsewhere.
const STAGE_OPTIONS = [
  "applied",
  "screening",
  "phone_screen",
  "interview",
  "screen",
  "tech",
  "offer",
  "hired",
  "rejected",
];

const ITEMS_PER_PAGE = 15;

function CandidatesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stage, setStage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [boardStages, setBoardStages] = useState({});

  // debounce searchQuery similar to JobsPage
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      if (stage && stage !== "all") params.set("stage", stage);
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/candidates?${params.toString()}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      // Deduplicate candidates by id in case the API returns duplicates
      const itemsRaw = data.items || [];
      const uniqueItems = Array.from(
        new Map(itemsRaw.map((it) => [String(it.id), it])).values()
      );
      setItems(uniqueItems);
      // Use server total for pagination when available; fallback to uniqueItems length
      setTotal(
        typeof data.total === "number" ? data.total : uniqueItems.length
      );
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and when filters/page changes
  useEffect(() => {
    fetchPage();
  }, [page, stage, debouncedQuery]);

  // Listen for global stage-change events emitted by the Kanban board so
  // candidate cards update instantly without a full page reload.
  useEffect(() => {
    const handleStageChanged = (ev) => {
      try {
        const d = ev.detail || {};
        const cid = d.candidateId;
        const newStage = d.stage;
        if (!cid) return;

        // Update board stages map first
        setBoardStages((prev) => ({
          ...prev,
          [cid]: newStage,
        }));

        setItems((prev) =>
          prev.map((it) => {
            if (String(it.id) !== String(cid)) return it;
            const sub = it.submissions && it.submissions[0];
            const updatedSub = sub
              ? { ...sub, stage: newStage }
              : { candidateId: it.id, stage: newStage };
            return { ...it, submissions: [updatedSub] };
          })
        );
      } catch (e) {
        // ignore handler errors
      }
    };

    window.addEventListener("candidateStageChanged", handleStageChanged);
    return () =>
      window.removeEventListener("candidateStageChanged", handleStageChanged);
  }, []);

  // Polling disabled: automatic refresh removed to avoid page reloads

  // client-side filter is still applied over the fetched page (optional)
  const filtered = useMemo(() => {
    if (!debouncedQuery) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [items, debouncedQuery]);

  // totalPages is computed where PaginationControls is rendered

  const Row = ({ index, style }) => {
    const cand = filtered[index];
    if (!cand) return null;
    const sub = cand.submissions && cand.submissions[0];
    return (
      <div className="candidate-card" style={{ ...style }}>
        <div className="candidate-left">
          <div className="candidate-avatar" aria-hidden>
            {cand.name ? cand.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="candidate-info">
            <Link className="candidate-name" to={`/candidates/${cand.id}`}>
              {cand.name}
            </Link>
            <div className="candidate-email">{cand.email}</div>
          </div>
        </div>

        <div className="candidate-right">
          {/* <div className={`candidate-stage ${sub ? sub.stage : "unknown"}`}>
            {sub ? sub.stage : "-"}
          </div>
          <div className="candidate-stage-editor">
            <select
              value={sub ? sub.stage : "applied"}
              onChange={async (e) => {
                const newStage = e.target.value;
                const candidateId = cand.id;

                // optimistic update locally
                setItems((prev) =>
                  prev.map((it) => {
                    if (String(it.id) !== String(candidateId)) return it;
                    const s = it.submissions && it.submissions[0];
                    const updatedSub = s
                      ? { ...s, stage: newStage }
                      : { candidateId: it.id, stage: newStage };
                    return { ...it, submissions: [updatedSub] };
                  })
                );

                // fire optimistic global event
                try {
                  window.dispatchEvent(
                    new CustomEvent("candidateStageChanged", {
                      detail: {
                        candidateId,
                        stage: newStage,
                        confirmed: false,
                      },
                    })
                  );
                } catch (err) {}

                // call server
                try {
                  const res = await fetch(
                    `/api/candidates/${candidateId}/stage`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ stage: newStage }),
                    }
                  );
                  if (res.ok) {
                    const updated = await res.json();
                    // update local items with returned data if present
                    setItems((prev) =>
                      prev.map((it) => {
                        if (String(it.id) !== String(candidateId)) return it;
                        const s = it.submissions && it.submissions[0];
                        const updatedSub = s
                          ? {
                              ...s,
                              stage: newStage,
                              updatedAt:
                                updated.updatedAt || new Date().toISOString(),
                            }
                          : { candidateId: it.id, stage: newStage };
                        return { ...it, submissions: [updatedSub] };
                      })
                    );

                    // fire confirmed event
                    try {
                      window.dispatchEvent(
                        new CustomEvent("candidateStageChanged", {
                          detail: {
                            candidateId,
                            stage: newStage,
                            confirmed: true,
                          },
                        })
                      );
                    } catch (err) {}
                  } else {
                    throw new Error(`Failed to update stage: ${res.status}`);
                  }
                } catch (err) {
                  // rollback by refetching current page
                  fetchPage();
                }
              }}
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div> */}
          <button
            className="view-button"
            onClick={() => navigate(`/candidates/${cand.id}`)}
          >
            View
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="jobs-page">
      <div className="jobs-header">
        <div className="header-left">
          <h2>Candidates</h2>
          <div className="filter-container">
            <select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setPage(1);
              }}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="header-right">
          <div className="search-container">
            <input
              type="search"
              className="search-input"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading && <div className="loading-message">Loading...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <>
          <div className="candidates-viewport">
            <div className="candidates-grid">
              {/* ensure visible list is deduplicated again at render time to avoid any duplicates
                  coming from the API or intermediate transforms */}
              {(() => {
                const uniqueVisible = Array.from(
                  new Map(
                    (filtered || []).map((it) => [String(it.id), it])
                  ).values()
                );
                return uniqueVisible.map((item, index) => {
                  const sub = item.submissions && item.submissions[0];
                  return (
                    <div className="candidate-card" key={item.id || index}>
                      <div className="candidate-left">
                        <div className="candidate-avatar" aria-hidden>
                          {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div className="candidate-info">
                          <Link
                            className="candidate-name"
                            to={`/candidates/${item.id}`}
                          >
                            {item.name}
                          </Link>
                          <div className="candidate-email">{item.email}</div>
                        </div>
                      </div>

                      <div className="candidate-right">
                        {/* <div
                          className={`candidate-stage ${
                            boardStages[item.id] ||
                            (sub ? sub.stage : "unknown")
                          }`}
                        >
                          {boardStages[item.id] || (sub ? sub.stage : "-")}
                        </div>
                        <div className="candidate-stage-editor">
                          <select
                            value={sub ? sub.stage : "applied"}
                            onChange={async (e) => {
                              const newStage = e.target.value;
                              const candidateId = item.id;

                              // optimistic update of visible grid
                              setItems((prev) =>
                                prev.map((it) => {
                                  if (String(it.id) !== String(candidateId))
                                    return it;
                                  const s = it.submissions && it.submissions[0];
                                  const updatedSub = s
                                    ? { ...s, stage: newStage }
                                    : { candidateId: it.id, stage: newStage };
                                  return { ...it, submissions: [updatedSub] };
                                })
                              );

                              try {
                                window.dispatchEvent(
                                  new CustomEvent("candidateStageChanged", {
                                    detail: {
                                      candidateId,
                                      stage: newStage,
                                      confirmed: false,
                                    },
                                  })
                                );
                              } catch (err) {}

                              try {
                                const res = await fetch(
                                  `/api/candidates/${candidateId}/stage`,
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ stage: newStage }),
                                  }
                                );
                                if (res.ok) {
                                  const updated = await res.json();
                                  setItems((prev) =>
                                    prev.map((it) => {
                                      if (String(it.id) !== String(candidateId))
                                        return it;
                                      const s =
                                        it.submissions && it.submissions[0];
                                      const updatedSub = s
                                        ? {
                                            ...s,
                                            stage: newStage,
                                            updatedAt:
                                              updated.updatedAt ||
                                              new Date().toISOString(),
                                          }
                                        : {
                                            candidateId: it.id,
                                            stage: newStage,
                                          };
                                      return {
                                        ...it,
                                        submissions: [updatedSub],
                                      };
                                    })
                                  );
                                  try {
                                    window.dispatchEvent(
                                      new CustomEvent("candidateStageChanged", {
                                        detail: {
                                          candidateId,
                                          stage: newStage,
                                          confirmed: true,
                                        },
                                      })
                                    );
                                  } catch (err) {}
                                } else {
                                  throw new Error(
                                    `Failed to update stage: ${res.status}`
                                  );
                                }
                              } catch (err) {
                                fetchPage();
                              }
                            }}
                          >
                            {STAGE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div> */}
                        <button
                          className="view-button"
                          onClick={() => navigate(`/candidates/${item.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          {!loading && !error && items.length > 0 && (
            <PaginationControls
              page={page}
              totalPages={Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

export default CandidatesPage;
