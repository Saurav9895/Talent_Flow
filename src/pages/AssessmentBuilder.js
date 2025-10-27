import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AssessmentBuilder.css";

const QUESTION_TYPES = {
  SINGLE_CHOICE: "single-choice",
  MULTI_CHOICE: "multi-choice",
  SHORT_TEXT: "short-text",
  LONG_TEXT: "long-text",
  NUMERIC: "numeric",
  FILE_UPLOAD: "file-upload",
};

// Individual question type components
const SingleChoiceQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">Single Choice</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
    <div className="option-list">
      {question.options.map((option, idx) => (
        <div key={idx} className="option-item">
          <input
            type="text"
            value={option}
            onChange={(e) => {
              const newOptions = [...question.options];
              newOptions[idx] = e.target.value;
              onChange({ ...question, options: newOptions });
            }}
            placeholder={`Option ${idx + 1}`}
          />
          <button
            className="danger"
            onClick={() => {
              const newOptions = question.options.filter((_, i) => i !== idx);
              onChange({ ...question, options: newOptions });
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
    <button
      className="add-option-btn"
      onClick={() =>
        onChange({
          ...question,
          options: [...question.options, ""],
        })
      }
    >
      Add Option
    </button>
  </div>
);

const MultiChoiceQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">Multiple Choice</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
    <div className="option-list">
      {question.options.map((option, idx) => (
        <div key={idx} className="option-item">
          <input
            type="text"
            value={option}
            onChange={(e) => {
              const newOptions = [...question.options];
              newOptions[idx] = e.target.value;
              onChange({ ...question, options: newOptions });
            }}
            placeholder={`Option ${idx + 1}`}
          />
          <button
            className="danger"
            onClick={() => {
              const newOptions = question.options.filter((_, i) => i !== idx);
              onChange({ ...question, options: newOptions });
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
    <button
      className="add-option-btn"
      onClick={() =>
        onChange({
          ...question,
          options: [...question.options, ""],
        })
      }
    >
      Add Option
    </button>
  </div>
);

const ShortTextQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">Short Text</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
  </div>
);

const LongTextQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">Long Text</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
  </div>
);

const NumericQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">Numeric</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
    <div className="numeric-constraints">
      <label>
        Min:
        <input
          type="number"
          value={question.min}
          onChange={(e) =>
            onChange({ ...question, min: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Max:
        <input
          type="number"
          value={question.max}
          onChange={(e) =>
            onChange({ ...question, max: Number(e.target.value) })
          }
        />
      </label>
    </div>
  </div>
);

const FileUploadQuestion = ({ question, onChange, onDelete }) => (
  <div className="question-card">
    <div className="question-header">
      <div>
        <input
          type="text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Enter question text"
        />
        <div className="question-type">File Upload</div>
      </div>
      <button className="danger" onClick={onDelete}>
        Remove
      </button>
    </div>
    <div className="input-group">
      <label>Allowed file types (comma-separated)</label>
      <input
        type="text"
        value={question.allowedTypes}
        onChange={(e) =>
          onChange({ ...question, allowedTypes: e.target.value })
        }
        placeholder="pdf,doc,docx"
      />
    </div>
  </div>
);

// Small input component that keeps local state while typing and debounces updates
const ConditionInput = ({ value, onChangeValue }) => {
  const [local, setLocal] = useState(value || "");

  // keep local in sync when parent value changes (e.g., when selecting a different question)
  useEffect(() => {
    setLocal(value || "");
  }, [value]);

  // debounce propagation to parent to avoid frequent re-renders stealing focus
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== (value || "")) onChangeValue(local);
    }, 300);
    return () => clearTimeout(t);
  }, [local, value, onChangeValue]);

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== (value || "")) onChangeValue(local);
      }}
      placeholder="equals..."
      style={{ width: 150 }}
    />
  );
};

// Local number input for maxLength with debounce and blur flush
const NumberInput = ({ value, onChangeValue, min = 0, style }) => {
  const [local, setLocal] = useState(String(value ?? ""));

  useEffect(() => {
    setLocal(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      const parsed = Number(local);
      if (!Number.isNaN(parsed) && parsed !== (value ?? 0)) {
        onChangeValue(parsed);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [local, value, onChangeValue]);

  return (
    <input
      type="number"
      min={min}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = Number(local);
        if (Number.isNaN(parsed)) return;
        if (parsed < min) setLocal(String(min));
        onChangeValue(parsed);
      }}
      style={style}
    />
  );
};

const QuestionComponent = ({
  question,
  previousQuestions = [],
  onChange,
  onDelete,
}) => {
  // Simple validation controls
  const ValidationControls = () => (
    <div
      className="validation-controls"
      
    >
      <div>
        <label style={{ marginRight: 16 }}>
          <input
            type="checkbox"
            checked={!!question.required}
            onChange={(e) =>
              onChange({ ...question, required: e.target.checked })
            }
          />{" "}
          Required
        </label>
      </div>
      {previousQuestions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            Show this question if:
          </div>
          <select
            value={question.condition?.questionId || ""}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (!selectedId) {
                onChange({ ...question, condition: null });
                return;
              }
              const targetQ = previousQuestions.find(
                (q) => String(q.id) === selectedId
              );
              onChange({
                ...question,
                condition: {
                  questionId: selectedId,
                  value: "",
                  questionText: targetQ?.text || "Question " + selectedId,
                },
              });
            }}
            style={{ marginRight: 8 }}
          >
            <option value="">No condition</option>
            {previousQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.text || `Question ${q.id}`}
              </option>
            ))}
          </select>

          {question.condition && (
            <ConditionInput
              value={question.condition.value || ""}
              onChangeValue={(val) =>
                onChange({
                  ...question,
                  condition: {
                    ...question.condition,
                    value: val,
                  },
                })
              }
            />
          )}
        </div>
      )}

      {/* max length control for short/long text questions */}
      {(question.type === QUESTION_TYPES.SHORT_TEXT ||
        question.type === QUESTION_TYPES.LONG_TEXT) && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            Max length (0 = no limit):{" "}
            <NumberInput
              value={question.maxLength ?? 0}
              onChangeValue={(n) => onChange({ ...question, maxLength: n })}
              min={0}
              style={{ width: 100, marginLeft: 8 }}
            />
          </label>
        </div>
      )}
    </div>
  );

  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
      return (
        <div>
          <SingleChoiceQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    case QUESTION_TYPES.MULTI_CHOICE:
      return (
        <div>
          <MultiChoiceQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    case QUESTION_TYPES.SHORT_TEXT:
      return (
        <div>
          <ShortTextQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    case QUESTION_TYPES.LONG_TEXT:
      return (
        <div>
          <LongTextQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    case QUESTION_TYPES.NUMERIC:
      return (
        <div>
          <NumericQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    case QUESTION_TYPES.FILE_UPLOAD:
      return (
        <div>
          <FileUploadQuestion
            question={question}
            onChange={onChange}
            onDelete={onDelete}
          />
          <ValidationControls />
        </div>
      );
    default:
      return null;
  }
};

// Live preview panel renders a fillable form based on current builder state.
const PreviewPanel = ({ sections, job }) => {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});

  // reset answers when sections change structure
  useEffect(() => {
    setAnswers({});
    setErrors({});
  }, [sections]);

  const handleAnswer = (questionId, value) => {
    setAnswers((s) => ({ ...s, [questionId]: value }));
  };

  const isVisible = (question) => {
    const cond = question.condition;
    if (!cond || !cond.questionId) return true;
    const qid = String(cond.questionId);
    const actual = answers[qid];
    const expected = cond.value;
    if (Array.isArray(actual)) {
      return actual.includes(expected);
    }
    // treat numbers and strings similarly by stringifying
    return String(actual) === String(expected);
  };

  const validate = () => {
    const newErrors = {};
    sections.forEach((section) => {
      (section.questions || []).forEach((q) => {
        if (!isVisible(q)) return; // skip hidden
        const qid = String(q.id);
        const val = answers[qid];
        if (q.required) {
          if (
            val === undefined ||
            val === null ||
            (typeof val === "string" && val.trim() === "") ||
            (Array.isArray(val) && val.length === 0)
          ) {
            newErrors[qid] = "This question is required";
            return;
          }
        }
        if (
          (q.type === QUESTION_TYPES.SHORT_TEXT ||
            q.type === QUESTION_TYPES.LONG_TEXT) &&
          q.maxLength &&
          q.maxLength > 0
        ) {
          if (val && String(val).length > q.maxLength) {
            newErrors[qid] = `Maximum length is ${q.maxLength}`;
            return;
          }
        }
        if (q.type === QUESTION_TYPES.NUMERIC) {
          if (val !== "" && val !== undefined && val !== null) {
            const num = Number(val);
            if (!Number.isNaN(q.min) && num < q.min)
              newErrors[qid] = `Minimum is ${q.min}`;
            if (!Number.isNaN(q.max) && num > q.max)
              newErrors[qid] = `Maximum is ${q.max}`;
          }
        }
      });
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const renderQuestion = (question) => {
    if (!isVisible(question)) return null;
    const qid = String(question.id);
    const val = answers[qid];
    const err = errors[qid];

    switch (question.type) {
      case QUESTION_TYPES.SINGLE_CHOICE:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            {(question.options || []).map((opt, i) => (
              <div key={i}>
                <label>
                  <input
                    type="radio"
                    name={`q-${qid}`}
                    checked={val === opt}
                    onChange={() => handleAnswer(qid, opt)}
                  />{" "}
                  {opt || `Option ${i + 1}`}
                </label>
              </div>
            ))}
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      case QUESTION_TYPES.MULTI_CHOICE:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            {(question.options || []).map((opt, i) => {
              const selected = Array.isArray(val) && val.includes(opt);
              return (
                <div key={i}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={() => {
                        const prev = Array.isArray(val) ? val.slice() : [];
                        const idx = prev.indexOf(opt);
                        if (idx === -1) prev.push(opt);
                        else prev.splice(idx, 1);
                        handleAnswer(qid, prev);
                      }}
                    />{" "}
                    {opt || `Option ${i + 1}`}
                  </label>
                </div>
              );
            })}
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      case QUESTION_TYPES.SHORT_TEXT:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            <input
              type="text"
              value={val || ""}
              onChange={(e) => handleAnswer(qid, e.target.value)}
            />
            {question.maxLength > 0 && (
              <div className="preview-muted">
                {String(val || "").length}/{question.maxLength}
              </div>
            )}
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      case QUESTION_TYPES.LONG_TEXT:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            <textarea
              value={val || ""}
              onChange={(e) => handleAnswer(qid, e.target.value)}
            />
            {question.maxLength > 0 && (
              <div className="preview-muted">
                {String(val || "").length}/{question.maxLength}
              </div>
            )}
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      case QUESTION_TYPES.NUMERIC:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            <input
              type="number"
              min={question.min}
              max={question.max}
              value={val || ""}
              onChange={(e) =>
                handleAnswer(
                  qid,
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
            <div className="preview-muted">
              Min: {question.min} · Max: {question.max}
            </div>
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      case QUESTION_TYPES.FILE_UPLOAD:
        return (
          <div className="preview-question" key={qid}>
            <label>{question.text || "(no text)"}</label>
            <input
              type="file"
              onChange={(e) =>
                handleAnswer(qid, e.target.files && e.target.files[0])
              }
            />
            <div className="preview-muted">
              Allowed: {question.allowedTypes || "any"}
            </div>
            {err && <div style={{ color: "#d73a49", marginTop: 6 }}>{err}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  if (!sections || sections.length === 0) {
    return (
      <div className="preview-muted">
        No sections — preview will appear here.
      </div>
    );
  }

  return (
    <form className="preview-form" onSubmit={(e) => e.preventDefault()}>
      {/* Validate button removed: preview validates on submit or when submitting candidate form */}
      {sections.map((section) => (
        <div key={section.id} className="preview-section">
          <div>
            <strong>{section.title || "Untitled Section"}</strong>
            {section.description && (
              <div className="preview-muted">{section.description}</div>
            )}
          </div>
          <div>{(section.questions || []).map((q) => renderQuestion(q))}</div>
        </div>
      ))}
    </form>
  );
};

function AssessmentBuilder() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [job, setJob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        // Load job details
        const jobRes = await fetch(`/api/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error("Failed to load job");
        const jobData = await jobRes.json();
        setJob(jobData);

        // Load existing assessment if any
        const assessmentRes = await fetch(`/api/assessments/${jobId}`);
        console.log(
          "Loading assessment result:",
          await assessmentRes.clone().text()
        );
        if (assessmentRes.ok) {
          const assessmentData = await assessmentRes.json();
          console.log("Assessment data:", assessmentData);
          if (!assessmentData) {
            setError("Assessment not found");
            return;
          }
          // normalize older payloads: map dependsOn -> condition, ensure maxLength exists
          const normalized = (assessmentData.sections || []).map((section) => ({
            ...section,
            questions: (section.questions || []).map((q) => {
              const copy = { ...q };
              if (copy.dependsOn && !copy.condition) {
                copy.condition = {
                  questionId: copy.dependsOn.id || copy.dependsOn.questionId,
                  value: copy.dependsOn.value || "",
                  questionText:
                    copy.dependsOn.questionText || copy.dependsOn.questionText,
                };
                delete copy.dependsOn;
              }
              if (
                (copy.type === QUESTION_TYPES.SHORT_TEXT ||
                  copy.type === QUESTION_TYPES.LONG_TEXT) &&
                copy.maxLength === undefined
              ) {
                copy.maxLength = 0;
              }
              if (copy.condition === undefined) copy.condition = null;
              return copy;
            }),
          }));

          setSections(normalized);
        } else {
          // If no assessment on the server, try to restore an in-progress draft from localStorage
          try {
            const draftKey = `assessment-draft-${jobId}`;
            const draft = localStorage.getItem(draftKey);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (Array.isArray(parsed)) setSections(parsed);
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      } catch (err) {
        setError(err.message);
      }
    };

    loadAssessment();
  }, [jobId]);

  // Persist builder state locally and auto-save to server (debounced)
  useEffect(() => {
    const draftKey = `assessment-draft-${jobId}`;
    try {
      localStorage.setItem(draftKey, JSON.stringify(sections || []));
    } catch (e) {
      // ignore storage errors
    }

    if (!jobId) return undefined;
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/assessments/${jobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections }),
        });
        // on success remove local draft to avoid stale restores
        try {
          localStorage.removeItem(draftKey);
        } catch (e) {
          // ignore
        }
      } catch (err) {
        // ignore autosave network errors; draft remains in localStorage
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [sections, jobId]);

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: Date.now(),
        title: "New Section",
        description: "",
        questions: [],
      },
    ]);
  };

  const updateSection = (sectionId, updates) => {
    setSections(
      sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    );
  };

  const deleteSection = (sectionId) => {
    setSections(sections.filter((section) => section.id !== sectionId));
  };

  const addQuestion = (sectionId, type) => {
    const newQuestion = {
      id: Date.now(),
      type,
      text: "",
      required: false,
      condition: null,
    };

    // Add type-specific properties
    switch (type) {
      case QUESTION_TYPES.SINGLE_CHOICE:
      case QUESTION_TYPES.MULTI_CHOICE:
        newQuestion.options = [""];
        break;
      case QUESTION_TYPES.NUMERIC:
        newQuestion.min = 0;
        newQuestion.max = 100;
        newQuestion.step = 1;
        break;
      case QUESTION_TYPES.FILE_UPLOAD:
        newQuestion.allowedTypes = "pdf,doc,docx";
        break;
      case QUESTION_TYPES.SHORT_TEXT:
      case QUESTION_TYPES.LONG_TEXT:
        newQuestion.maxLength = 0; // 0 means no limit
        break;
      default:
        break;
    }

    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            questions: [...section.questions, newQuestion],
          };
        }
        return section;
      })
    );
  };

  const updateQuestion = (sectionId, questionId, updates) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            questions: section.questions.map((question) =>
              question.id === questionId
                ? { ...question, ...updates }
                : question
            ),
          };
        }
        return section;
      })
    );
  };

  const deleteQuestion = (sectionId, questionId) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            questions: section.questions.filter((q) => q.id !== questionId),
          };
        }
        return section;
      })
    );
  };

  const saveAssessment = async () => {
    setSaving(true);
    setError(null);

    try {
      console.log("Saving assessment:", { jobId, sections });
      const res = await fetch(`/api/assessments/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, jobId }),
      });

      if (!res.ok) throw new Error("Failed to save assessment");

      // Navigate back to assessments page
      navigate("/assessments");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (!job) return <div>Loading...</div>;

  return (
    <div className="assessment-builder">
      <div className="assessment-header">
        <div>
          <h1>Assessment Builder</h1>
          <h2>{job.title}</h2>
        </div>
        <div className="actions">
          <button onClick={() => navigate("/assessments")}>Cancel</button>
          <button
            className="primary"
            onClick={saveAssessment}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Assessment"}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="assessment-grid">
        <div className="builder-column">
          {sections.map((section) => (
            <div key={section.id} className="section-card">
              <div className="section-header">
                <div className="section-header-content">
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) =>
                      updateSection(section.id, { title: e.target.value })
                    }
                    placeholder="Section Title"
                    className="section-title"
                  />
                  <textarea
                    value={section.description}
                    onChange={(e) =>
                      updateSection(section.id, { description: e.target.value })
                    }
                    placeholder="Section Description"
                  />
                </div>
              </div>

              {section.questions.map((question) => (
                <QuestionComponent
                  key={question.id}
                  question={question}
                  previousQuestions={sections.reduce((acc, s) => {
                    // Get all questions that come before this one in this section
                    const sectionQuestions =
                      s.id === section.id
                        ? s.questions.filter((q) => q.id < question.id)
                        : s.questions || [];
                    return acc.concat(sectionQuestions);
                  }, [])}
                  onChange={(updates) =>
                    updateQuestion(section.id, question.id, updates)
                  }
                  onDelete={() => deleteQuestion(section.id, question.id)}
                />
              ))}

              <div className="actions">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addQuestion(section.id, e.target.value);
                      e.target.value = "";
                    }
                  }}
                  value=""
                >
                  <option value="">Add Question...</option>
                  <option value={QUESTION_TYPES.SINGLE_CHOICE}>
                    Single Choice
                  </option>
                  <option value={QUESTION_TYPES.MULTI_CHOICE}>
                    Multiple Choice
                  </option>
                  <option value={QUESTION_TYPES.SHORT_TEXT}>Short Text</option>
                  <option value={QUESTION_TYPES.LONG_TEXT}>Long Text</option>
                  <option value={QUESTION_TYPES.NUMERIC}>Numeric</option>
                  <option value={QUESTION_TYPES.FILE_UPLOAD}>
                    File Upload
                  </option>
                </select>
              </div>
              <button
                className="danger delete-btn"
                onClick={() => deleteSection(section.id)}
              >
                Delete Section
              </button>
            </div>
          ))}

          <button onClick={addSection}>Add Section</button>
        </div>

        <div className="preview-column">
          <div className="preview-header">
            <div>
              <strong>Live Preview</strong>
            </div>
            <div className="preview-muted">{job.title}</div>
          </div>
          <PreviewPanel sections={sections} job={job} />
        </div>
      </div>
    </div>
  );
}

export default AssessmentBuilder;
