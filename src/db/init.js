import { db, jobs, candidates, assessments, submissions } from "./schema";
import { timelines, teamMembers } from "./schema";

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
export async function initDB() {
  try {
    await db.open();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Configuration for seeding the database
 * @typedef {Object} SeedConfig
 * @property {number} [jobCount=10]
 * @property {number} [candidateCount=20]
 * @property {number} [assessmentCount=5]
 */

/**
 * Generate mock data and seed the database if empty
 * @param {SeedConfig} config
 * @returns {Promise<void>}
 */
export async function seedIfEmpty(config = {}) {
  // Restore the original small default dataset: 25 candidates
  const { jobCount = 10, candidateCount = 25, assessmentCount = 5 } = config;

  // No external asset import: always use the built-in generator for candidates.
  // The previous behavior that attempted to fetch `/data/...` has been removed
  // per user request so generated asset files are not imported automatically.

  // If an asset was found, clear relevant tables so we can re-seed from it
  // NOTE: do not clear DB here. Seeding from assetCandidates should only occur
  // when the DB is empty. Clearing on every reload caused race conditions
  // where frontend requests (e.g. candidate detail) ran while the DB was being
  // reinitialized and returned 404. The actual import is performed below in
  // the seeding branch which runs only when the DB is empty.

  // Check if database is empty
  const [jobsCount, candidatesCount, assessmentsCount] = await Promise.all([
    jobs.count(),
    candidates.count(),
    assessments.count(),
  ]);

  if (jobsCount > 0 || candidatesCount > 0 || assessmentsCount > 0) {
    console.log(
      "Database already contains data, running candidate appliedJobs migration if needed"
    );

    // Migration: ensure existing candidates have appliedJobs populated from submissions
    try {
      const existingCandidates = await candidates.toArray();
      for (const cand of existingCandidates) {
        // If candidate already has exactly one applied job, skip
        if (Array.isArray(cand.appliedJobs) && cand.appliedJobs.length === 1)
          continue;

        // Build appliedJobs from submissions table (prefer submissions as source of truth)
        try {
          // eslint-disable-next-line no-await-in-loop
          const candSubs = await submissions
            .where("candidateId")
            .equals(cand.id)
            .toArray();
          // sort subs by submittedAt descending to prefer most recent
          candSubs.sort(
            (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
          );
          const applied = [];
          for (const s of candSubs) {
            // eslint-disable-next-line no-await-in-loop
            const j = await jobs.get(s.jobId);
            if (j && !applied.some((x) => x.id === j.id)) applied.push(j);
          }

          // Fallback: if no submissions but assignedJobs exists (legacy), use those ids
          if (
            applied.length === 0 &&
            Array.isArray(cand.assignedJobs) &&
            cand.assignedJobs.length > 0
          ) {
            for (const jid of cand.assignedJobs) {
              // eslint-disable-next-line no-await-in-loop
              const j = await jobs.get(jid);
              if (j && !applied.some((x) => x.id === j.id)) applied.push(j);
            }
          }

          // Ensure only one applied job is stored (take the most relevant — first in applied)
          const finalApplied = applied.length > 0 ? [applied[0]] : [];

          if (finalApplied.length > 0) {
            // eslint-disable-next-line no-await-in-loop
            await candidates.update(cand.id, {
              appliedJobs: finalApplied,
              assignedJobs:
                cand.assignedJobs && cand.assignedJobs.length > 0
                  ? [cand.assignedJobs[0]]
                  : finalApplied.map((j) => j.id),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          // ignore errors per-candidate
          // eslint-disable-next-line no-console
          console.warn(
            `Failed to compute appliedJobs for candidate ${cand.id}`,
            e
          );
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to run appliedJobs migration", e);
    }

    // Ensure every candidate has at least one applied job (assign if missing)
    try {
      const allJobs = await jobs.toArray();
      if (allJobs && allJobs.length > 0) {
        const candidatesList = await candidates.toArray();
        let idx = 0;
        for (const c of candidatesList) {
          if (!Array.isArray(c.appliedJobs) || c.appliedJobs.length === 0) {
            const job = allJobs[idx % allJobs.length];
            idx += 1;
            try {
              await candidates.update(c.id, {
                appliedJobs: [job],
                assignedJobs:
                  Array.isArray(c.assignedJobs) && c.assignedJobs.length > 0
                    ? c.assignedJobs
                    : [job.id],
                updatedAt: new Date().toISOString(),
              });
            } catch (err) {
              // ignore per-candidate update error
            }
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to assign fallback jobs to candidates", e);
    }

    return;
  }

  // Generate mock data (or import from public/data/candidates.json if present)
  const jobsData = Array.from({ length: jobCount }, (_, i) => ({
    title: `Software Engineer ${i + 1}`,
    description: `Description for job ${i + 1}`,
    company: `Company ${i + 1}`,
    location: ["Remote", "New York", "San Francisco", "London"][
      Math.floor(Math.random() * 4)
    ],
    type: ["full-time", "part-time", "contract"][Math.floor(Math.random() * 3)],
    postedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    status: Math.random() > 0.2 ? "open" : "closed",
  }));
  const assessmentsData = Array.from({ length: assessmentCount }, (_, i) => ({
    title: `Assessment ${i + 1}`,
    description: `Description for assessment ${i + 1}`,
    type: ["technical", "personality", "language"][
      Math.floor(Math.random() * 3)
    ],
    duration: [30, 45, 60, 90][Math.floor(Math.random() * 4)],
    skills: [
      "Problem Solving",
      "Communication",
      "Technical Knowledge",
      "Language Proficiency",
    ]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 1),
    createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
  }));

  // Seed the database
  try {
    await db.transaction(
      "rw",
      [jobs, candidates, assessments, submissions],
      async () => {
        // First add jobs so we can reference them
        await jobs.bulkAdd(jobsData);
        const insertedJobs = await jobs.toArray();

        // Generate candidates data (built-in generator) — no asset import
        const candidatesData = Array.from(
          { length: candidateCount },
          (_, i) => ({
            name: `Candidate ${i + 1}`,
            email: `candidate${i + 1}@example.com`,
            phone: `+1234567${String(i).padStart(4, "0")}`,
            resume: `resume_${i + 1}.pdf`,
            skills: ["JavaScript", "React", "Node.js", "Python", "Java"]
              .sort(() => Math.random() - 0.5)
              .slice(0, Math.floor(Math.random() * 3) + 2),
            registrationDate: new Date(
              Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
            ),
          })
        );

        // For each candidate, randomly select 1 job they've applied to
        const enrichedCandidatesData = candidatesData.map((candidate) => {
          const jobCountLocal = 1;
          const appliedJobs = [];
          for (let i = 0; i < jobCountLocal; i++) {
            const job =
              insertedJobs[Math.floor(Math.random() * insertedJobs.length)];
            if (!appliedJobs.some((j) => j.id === job.id)) {
              appliedJobs.push(job);
            }
          }
          return {
            ...candidate,
            appliedJobs,
            assignedJobs: appliedJobs.map((j) => j.id),
          };
        });

        // Add candidates and assessments
        await candidates.bulkAdd(enrichedCandidatesData);
        await assessments.bulkAdd(assessmentsData);

        const insertedCandidates = await candidates.toArray();

        const stages = [
          "applied",
          "screening",
          "phone_screen",
          "interview",
          "offer",
          "hired",
          "rejected",
        ];

        const submissionsData = [];
        for (const cand of insertedCandidates) {
          const count = 1;
          for (let i = 0; i < count; i++) {
            const job =
              insertedJobs[Math.floor(Math.random() * insertedJobs.length)];
            submissionsData.push({
              candidateId: cand.id,
              jobId: job.id,
              assessmentId: null,
              score: null,
              status: ["pending", "completed", "reviewed"][
                Math.floor(Math.random() * 3)
              ],
              stage: stages[Math.floor(Math.random() * stages.length)],
              submittedAt: new Date(
                Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000
              ),
            });
          }
        }

        if (submissionsData.length > 0) {
          await submissions.bulkAdd(submissionsData);
        }

        // Update candidate records to include assignedJobs (job ids they applied to)
        try {
          const jobsByCandidate = {};
          for (const s of submissionsData) {
            if (!jobsByCandidate[s.candidateId])
              jobsByCandidate[s.candidateId] = [];
            if (!jobsByCandidate[s.candidateId].includes(s.jobId)) {
              jobsByCandidate[s.candidateId].push(s.jobId);
            }
          }

          const updates = Object.entries(jobsByCandidate).map(
            ([candId, jobIds]) =>
              candidates.update(Number(candId), { assignedJobs: jobIds })
          );
          if (updates.length > 0) await Promise.all(updates);
        } catch (e) {
          console.warn(
            "Failed to update candidates with assignedJobs during seed:",
            e
          );
        }
      }
    );

    const insertedJobs = await jobs.toArray();
    const insertedCandidates = await candidates.toArray();

    const stages = [
      "applied",
      "screening",
      "phone_screen",
      "interview",
      "offer",
      "hired",
      "rejected",
    ];

    const submissionsData = [];

    for (const cand of insertedCandidates) {
      // give each candidate 1-2 submissions (apply to 1-2 jobs)
      const count = 1;
      for (let i = 0; i < count; i++) {
        const job =
          insertedJobs[Math.floor(Math.random() * insertedJobs.length)];
        submissionsData.push({
          candidateId: cand.id,
          jobId: job.id,
          assessmentId: null,
          score: null,
          status: ["pending", "completed", "reviewed"][
            Math.floor(Math.random() * 3)
          ],
          stage: stages[Math.floor(Math.random() * stages.length)],
          submittedAt: new Date(
            Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000
          ),
        });
      }
    }

    if (submissionsData.length > 0) {
      await submissions.bulkAdd(submissionsData);
    }

    // Update candidate records to include assignedJobs (job ids they applied to)
    try {
      const jobsByCandidate = {};
      for (const s of submissionsData) {
        if (!jobsByCandidate[s.candidateId])
          jobsByCandidate[s.candidateId] = [];
        if (!jobsByCandidate[s.candidateId].includes(s.jobId)) {
          jobsByCandidate[s.candidateId].push(s.jobId);
        }
      }

      const updates = Object.entries(jobsByCandidate).map(([candId, jobIds]) =>
        candidates.update(Number(candId), { assignedJobs: jobIds })
      );
      if (updates.length > 0) await Promise.all(updates);
    } catch (e) {
      // ignore if candidate update fails during seed
      console.warn(
        "Failed to update candidates with assignedJobs during seed:",
        e
      );
    }

    // Create initial timeline entries for seeded submissions
    const timelinesData = [];
    for (const s of submissionsData) {
      // At least an 'applied' entry at the submission time
      timelinesData.push({
        candidateId: s.candidateId,
        note: `Applied to job ${s.jobId}`,
        stage: s.stage,
        createdAt: s.submittedAt,
      });

      // Random chance to have an extra note
      if (Math.random() < 0.2) {
        timelinesData.push({
          candidateId: s.candidateId,
          note: `Screening outcome: ${
            ["passed", "failed"][Math.floor(Math.random() * 2)]
          }`,
          stage: s.stage,
          createdAt: new Date(
            s.submittedAt.getTime() +
              Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000
          ),
        });
      }
    }

    if (timelinesData.length > 0) {
      await timelines.bulkAdd(timelinesData);
    }

    // For demo/testing: ensure candidate with id=1 has a clear 'offer' stage
    // at 2025-10-26 16:50:01 (UTC) so the UI shows "Current stage: offer"
    try {
      const demoDate = new Date("2025-10-26T16:50:01.000Z");
      const demoCand = await candidates.get(1);
      if (demoCand) {
        // update or create a submission for this candidate and set its stage to 'offer'
        const candSubs = await submissions
          .where("candidateId")
          .equals(1)
          .toArray();
        if (candSubs && candSubs.length > 0) {
          // pick most recent submission
          const latest = candSubs.sort(
            (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
          )[0];
          await submissions.update(latest.id, {
            stage: "offer",
            updatedAt: demoDate.toISOString(),
          });
        } else if (insertedJobs && insertedJobs.length > 0) {
          // create a submission referencing the first job
          const newSub = {
            candidateId: demoCand.id,
            jobId: insertedJobs[0].id,
            assessmentId: null,
            score: null,
            status: "completed",
            stage: "offer",
            submittedAt: demoDate.toISOString(),
            createdAt: demoDate.toISOString(),
            updatedAt: demoDate.toISOString(),
          };
          await submissions.add(newSub);
        }

        // persist a timeline entry at the same time so the timeline shows the update
        await timelines.add({
          candidateId: demoCand.id,
          note: "Stage updated to offer",
          stage: "offer",
          createdAt: demoDate.toISOString(),
        });
      }
    } catch (e) {
      // non-fatal: ignore demo seeding errors
      // eslint-disable-next-line no-console
      console.warn("Demo stage seeding failed:", e);
    }

    // Seed some team members for mentions
    const teamData = [
      { name: "Alice Johnson", email: "alice@example.com", role: "Recruiter" },
      { name: "Bob Smith", email: "bob@example.com", role: "Hiring Manager" },
      { name: "Carlos Ruiz", email: "carlos@example.com", role: "Interviewer" },
      { name: "Dana Lee", email: "dana@example.com", role: "Recruiter" },
      { name: "Eve Chen", email: "eve@example.com", role: "Sourcer" },
    ];
    try {
      await teamMembers.bulkAdd(teamData);
    } catch (e) {
      // ignore if already present or bulk add fails
    }
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Failed to seed database:", error);
    throw error;
  }
}
