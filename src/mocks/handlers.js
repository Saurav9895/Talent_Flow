import { http, HttpResponse } from "msw";
import {
  jobsApi,
  candidatesApi,
  assessmentsApi,
  submissionsApi,
  timelinesApi,
  teamMembersApi,
} from "../db/api";
import { simulateLatency, shouldSimulateError, errorResponse } from "./utils";

// Common handler for GET collections with pagination and search
const createGetCollectionHandler = (path, api) => {
  return http.get(path, async ({ request }) => {
    await simulateLatency();

    const url = new URL(request.url);
    const search = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const showArchived = url.searchParams.get("archived") === "true";
    const stageFilter = url.searchParams.get("stage") || null;
    const jobIdFilter = url.searchParams.get("jobId")
      ? parseInt(url.searchParams.get("jobId"))
      : null;

    try {
      let items = search ? await api.search(search) : await api.getAll();

      // Filter by archive status for jobs
      if (path === "/api/jobs") {
        items = items.filter((item) =>
          showArchived ? item.status === "archived" : item.status !== "archived"
        );
      }

      // For candidates we support server-like filtering by stage and jobId.
      if (path === "/api/candidates" && (stageFilter || jobIdFilter)) {
        const allSubmissions = await submissionsApi.getAll();
        const matchingCandidateIds = new Set(
          allSubmissions
            .filter((s) => {
              if (stageFilter && s.stage !== stageFilter) return false;
              if (jobIdFilter && s.jobId !== jobIdFilter) return false;
              return true;
            })
            .map((s) => s.candidateId)
        );

        items = items.filter((c) => matchingCandidateIds.has(c.id));
      }

      const start = (page - 1) * limit;
      let paginatedItems = items.slice(start, start + limit);

      // Deduplicate paginated results by id to avoid returning the same
      // candidate multiple times (defensive - fixes duplicate UI entries)
      if (paginatedItems && paginatedItems.length > 0) {
        paginatedItems = Array.from(
          new Map(paginatedItems.map((it) => [String(it.id), it])).values()
        );
      }

      // Enrich candidates on the returned page with their submissions to
      // include stage/job info for the UI
      if (path === "/api/candidates") {
        for (let i = 0; i < paginatedItems.length; i++) {
          const cand = paginatedItems[i];
          // attach submissions array
          // eslint-disable-next-line no-await-in-loop
          const candSubs = await submissionsApi.getByCandidate(cand.id);
          paginatedItems[i] = { ...cand, submissions: candSubs };
        }
      }

      return HttpResponse.json({
        items: paginatedItems,
        total: items.length,
        page,
        totalPages: Math.ceil(items.length / limit),
      });
    } catch (error) {
      return errorResponse("Failed to fetch data");
    }
  });
};

// Common handler for GET single item
const createGetItemHandler = (path, api) => {
  return http.get(`${path}/:id`, async ({ params }) => {
    await simulateLatency();

    try {
      let item = null;
      // Support string source IDs for candidates (e.g. 'cand-0001')
      if (path === "/api/candidates") {
        const raw = params.id;
        const num = Number(raw);
        if (!Number.isNaN(num)) {
          item = await api.getById(num);
        }
        if (!item) {
          // try lookup by sourceId field or stringified numeric id
          const all = await api.getAll();
          item = all.find(
            (c) => c.sourceId === raw || String(c.id) === String(raw)
          );
        }
      } else {
        item = await api.getById(parseInt(params.id));
      }
      if (!item) {
        return new HttpResponse(null, { status: 404 });
      }
      // If fetching a single candidate, enrich with submissions and latest stage
      if (path === "/api/candidates") {
        // eslint-disable-next-line no-await-in-loop
        const subs = await submissionsApi.getByCandidate(item.id);
        // Enrich submissions with job details
        const enrichedSubs = await Promise.all(
          subs.map(async (sub) => {
            const job = await jobsApi.getById(sub.jobId);
            return {
              ...sub,
              job, // Include full job details
            };
          })
        );
        item.submissions = enrichedSubs;
      }
      return HttpResponse.json(item);
    } catch (error) {
      return errorResponse("Failed to fetch item");
    }
  });
};

// Common handler for POST
const createPostHandler = (path, api) => {
  return http.post(path, async ({ request }) => {
    await simulateLatency();

    if (shouldSimulateError()) {
      return errorResponse("Random write error occurred");
    }

    try {
      const data = await request.json();
      const id = await api.add({
        ...data,
        createdAt: new Date().toISOString(),
      });

      const newItem = await api.getById(id);
      return HttpResponse.json(newItem, { status: 201 });
    } catch (error) {
      return errorResponse("Failed to create item");
    }
  });
};

// Common handler for PATCH
const createPatchHandler = (path, api) => {
  return http.patch(`${path}/:id`, async ({ params, request }) => {
    await simulateLatency();

    if (shouldSimulateError()) {
      return errorResponse("Random write error occurred");
    }

    try {
      const data = await request.json();
      let id = parseInt(params.id);

      // If this is a candidate and id is not numeric, try to resolve by sourceId
      if (path === "/api/candidates" && Number.isNaN(id)) {
        const all = await api.getAll();
        const found = all.find(
          (c) => c.sourceId === params.id || String(c.id) === params.id
        );
        if (found) id = found.id;
      }

      const exists = await api.getById(id);
      if (!exists) {
        return new HttpResponse(null, { status: 404 });
      }

      await api.update(id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });

      const updated = await api.getById(id);
      return HttpResponse.json(updated);
    } catch (error) {
      return errorResponse("Failed to update item");
    }
  });
};

// Jobs handlers
const jobsHandlers = [
  createGetCollectionHandler("/api/jobs", jobsApi),
  createGetCollectionHandler("/api/team", teamMembersApi),
  createGetItemHandler("/api/jobs", jobsApi),
  createPostHandler("/api/jobs", jobsApi),
  createPatchHandler("/api/jobs", jobsApi),

  // Reorder handler: reorder by array position and write back explicit order indices
  http.patch("/api/jobs/:id/reorder", async ({ params, request }) => {
    await simulateLatency();

    // Simulate random failure (~10% of the time)
    if (Math.random() < 0.1) {
      return new HttpResponse(
        JSON.stringify({ error: "Failed to reorder job (simulated)" }),
        { status: 500 }
      );
    }

    try {
      const data = await request.json();
      const id = parseInt(params.id);
      const fromIndex = Number(data.fromOrder);
      const toIndex = Number(data.toOrder);

      const exists = await jobsApi.getById(id);
      if (!exists) {
        return new HttpResponse(null, { status: 404 });
      }

      // Read all jobs as the current ordering source
      const allJobs = await jobsApi.getAll();

      // Guard indexes
      if (
        Number.isNaN(fromIndex) ||
        Number.isNaN(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= allJobs.length ||
        toIndex >= allJobs.length
      ) {
        return new HttpResponse(
          JSON.stringify({ error: "Invalid reorder indices" }),
          { status: 400 }
        );
      }

      // Create new ordered array by moving the item
      const moved = allJobs.slice();
      const [movedItem] = moved.splice(fromIndex, 1);
      moved.splice(toIndex, 0, movedItem);

      // Assign new order indices and persist
      const updatedJobs = [];
      for (let i = 0; i < moved.length; i++) {
        const job = {
          ...moved[i],
          order: i,
          updatedAt: new Date().toISOString(),
        };
        await jobsApi.update(job.id, job);
        updatedJobs.push(job);
      }

      return HttpResponse.json(updatedJobs);
    } catch (error) {
      return new HttpResponse(
        JSON.stringify({ error: "Failed to reorder job" }),
        { status: 500 }
      );
    }
  }),
];

// Candidates handlers
const candidatesHandlers = [
  createGetCollectionHandler("/api/candidates", candidatesApi),
  createGetItemHandler("/api/candidates", candidatesApi),
  createPostHandler("/api/candidates", candidatesApi),
  // Timeline endpoints for a candidate
  http.get("/api/candidates/:id/timeline", async ({ params }) => {
    await simulateLatency();
    try {
      let candidateId = parseInt(params.id);
      // allow sourceId like 'cand-0001' to be used in route
      if (Number.isNaN(candidateId)) {
        const allCands = await candidatesApi.getAll();
        const found = allCands.find(
          (c) => c.sourceId === params.id || String(c.id) === params.id
        );
        if (found) candidateId = found.id;
      }
      const entries = await timelinesApi.getByCandidate(candidateId);
      return HttpResponse.json(entries || []);
    } catch (err) {
      return errorResponse("Failed to fetch timeline");
    }
  }),

  http.post("/api/candidates/:id/timeline", async ({ params, request }) => {
    await simulateLatency();
    if (shouldSimulateError())
      return errorResponse("Random write error occurred");
    try {
      let candidateId = parseInt(params.id);
      if (Number.isNaN(candidateId)) {
        const allCands = await candidatesApi.getAll();
        const found = allCands.find(
          (c) => c.sourceId === params.id || String(c.id) === params.id
        );
        if (found) candidateId = found.id;
      }
      if (!candidateId) return errorResponse("Candidate not found");
      const data = await request.json();
      const entry = {
        candidateId,
        note: data.note || "",
        stage: data.stage || null,
        mentions: data.mentions || [],
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      const id = await timelinesApi.add(entry);
      const newEntry = await timelinesApi.getByCandidate(candidateId);
      return HttpResponse.json(newEntry[newEntry.length - 1], { status: 201 });
    } catch (err) {
      return errorResponse("Failed to create timeline entry");
    }
  }),
  // Patch candidate stage by updating their latest submission's stage
  http.patch("/api/candidates/:id/stage", async ({ params, request }) => {
    await simulateLatency();

    // Temporarily disable random errors for stage updates to debug
    // if (shouldSimulateError())
    //   return errorResponse("Random write error occurred");

    try {
      let candidateId = parseInt(params.id);
      if (Number.isNaN(candidateId)) {
        const allCands = await candidatesApi.getAll();
        const found = allCands.find(
          (c) => c.sourceId === params.id || String(c.id) === params.id
        );
        if (found) candidateId = found.id;
      }
      const data = await request.json();
      const newStage = data.stage;
      const jobId = data.jobId ? Number(data.jobId) : null;

      // Find submissions for candidate
      if (!candidateId) return errorResponse("Candidate not found");
      let subs = await submissionsApi.getByCandidate(candidateId);

      // If there are no submissions, create a new one
      if (!subs || subs.length === 0) {
        // First check if the candidate has any assigned or applied jobs
        const candidate = await candidatesApi.getById(candidateId);
        let defaultJobId = null;

        if (candidate) {
          if (candidate.assignedJobs && candidate.assignedJobs.length > 0) {
            defaultJobId = candidate.assignedJobs[0];
          } else if (
            candidate.appliedJobs &&
            candidate.appliedJobs.length > 0
          ) {
            defaultJobId = candidate.appliedJobs[0].id;
          }
        }

        // If no assigned jobs, use the first available job
        if (!defaultJobId) {
          const allJobs = await jobsApi.getAll();
          if (!allJobs || allJobs.length === 0) {
            return errorResponse("No jobs available to create a submission");
          }
          defaultJobId = jobId || allJobs[0].id;
        }

        const newSub = {
          candidateId,
          jobId: defaultJobId,
          assessmentId: null,
          score: null,
          status: "pending",
          stage: newStage,
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const createdId = await submissionsApi.add(newSub);
        const created = await submissionsApi.getById(createdId);

        // Persist a timeline entry for this stage change
        try {
          await timelinesApi.add({
            candidateId,
            note: `Stage set to ${newStage}`,
            stage: newStage,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          // ignore timeline persistence errors
        }

        return HttpResponse.json(created);
      }

      // Choose submission: match jobId if provided, else most recent
      let target = null;
      if (jobId) {
        target = subs.find((s) => s.jobId === jobId) || null;
      }
      if (!target) {
        target = subs.sort(
          (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
        )[0];
      }

      if (!target) return errorResponse("No submission found to update");

      await submissionsApi.update(target.id, {
        stage: newStage,
        updatedAt: new Date().toISOString(),
      });

      const updated = await submissionsApi.getById(target.id);
      // add timeline note about stage change
      try {
        await timelinesApi.add({
          candidateId,
          note: `Stage updated to ${newStage}`,
          stage: newStage,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        // ignore
      }

      return HttpResponse.json(updated);
    } catch (err) {
      return errorResponse("Failed to update candidate stage");
    }
  }),
  createPatchHandler("/api/candidates", candidatesApi),
  // Assign a job to a candidate (create submission) and optionally attach assessment
  http.post(
    "/api/candidates/:id/assign/:jobId",
    async ({ params, request }) => {
      await simulateLatency();

      if (shouldSimulateError())
        return errorResponse("Random write error occurred");

      try {
        let candidateId = parseInt(params.id);
        if (Number.isNaN(candidateId)) {
          const allCands = await candidatesApi.getAll();
          const found = allCands.find(
            (c) => c.sourceId === params.id || String(c.id) === params.id
          );
          if (found) candidateId = found.id;
        }
        const jobId = parseInt(params.jobId);
        const data = (await request.json()) || {};
        const assessmentId = data.assessmentId
          ? Number(data.assessmentId)
          : null;
        const stage = data.stage || "assigned";

        // basic validation
        const cand = await candidatesApi.getById(candidateId);
        const job = await jobsApi.getById(jobId);
        if (!cand || !job) return new HttpResponse(null, { status: 404 });

        // Instead of creating a submission immediately, store the job in the candidate record
        const existing = await candidatesApi.getById(candidateId);
        const assigned = Array.isArray(existing.assignedJobs)
          ? existing.assignedJobs.slice()
          : [];
        if (!assigned.includes(jobId)) assigned.unshift(jobId);

        await candidatesApi.update(candidateId, {
          assignedJobs: assigned,
          updatedAt: new Date().toISOString(),
        });

        const updatedCandidate = await candidatesApi.getById(candidateId);

        // Add timeline note about the assignment
        try {
          await timelinesApi.add({
            candidateId,
            note: `Assigned job ${jobId} to candidate`,
            stage,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          // ignore
        }

        return HttpResponse.json(updatedCandidate, { status: 200 });
      } catch (err) {
        return errorResponse("Failed to assign job to candidate");
      }
    }
  ),
];

// Submissions handlers - allow querying by candidateId and jobId via query string
const submissionsHandlers = [
  createGetCollectionHandler("/api/submissions", submissionsApi),
  createGetItemHandler("/api/submissions", submissionsApi),
  createPostHandler("/api/submissions", submissionsApi),
  createPatchHandler("/api/submissions", submissionsApi),
];

// Assessments handlers
const assessmentsHandlers = [
  createGetCollectionHandler("/api/assessments", assessmentsApi),
  createGetItemHandler("/api/assessments", assessmentsApi),
  createPostHandler("/api/assessments", assessmentsApi),
  createPatchHandler("/api/assessments", assessmentsApi),

  // Special handler for job-specific assessments
  http.put("/api/assessments/:jobId", async ({ params, request }) => {
    await simulateLatency();

    if (shouldSimulateError()) {
      return errorResponse("Random write error occurred");
    }

    try {
      const jobId = parseInt(params.jobId);
      const data = await request.json();

      // Validate job exists
      const job = await jobsApi.getById(jobId);
      if (!job) {
        return new HttpResponse(null, { status: 404 });
      }

      // Check if assessment already exists
      let assessment = await assessmentsApi.getById(jobId);
      if (assessment) {
        // Update existing
        await assessmentsApi.update(jobId, {
          ...data,
          jobId,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new
        await assessmentsApi.add({
          ...data,
          jobId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      assessment = await assessmentsApi.getById(jobId);
      return HttpResponse.json(assessment);
    } catch (error) {
      return errorResponse("Failed to save assessment");
    }
  }),
  // Candidate submission endpoint: persist submission for a job assessment
  http.post("/api/assessments/:jobId/submit", async ({ params, request }) => {
    await simulateLatency();

    if (shouldSimulateError())
      return errorResponse("Random write error occurred");

    try {
      const jobId = parseInt(params.jobId);
      const payload = await request.json();

      const candidateId = Number(payload.candidateId);
      const assessmentId = payload.assessmentId
        ? Number(payload.assessmentId)
        : null;
      const answers = payload.answers || {};

      // Basic validation
      if (!candidateId || !jobId) {
        return new HttpResponse(
          JSON.stringify({ error: "Missing candidateId or jobId" }),
          { status: 400 }
        );
      }

      const submission = {
        candidateId,
        jobId,
        assessmentId,
        answers,
        score: null,
        status: "completed",
        stage: "applied",
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const id = await submissionsApi.add(submission);
      const created = await submissionsApi.getById(id);

      // add a timeline note for candidate
      try {
        await timelinesApi.add({
          candidateId,
          note: `Submitted assessment for job ${jobId}`,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        // ignore timeline errors
      }

      return HttpResponse.json(created, { status: 201 });
    } catch (err) {
      return errorResponse("Failed to submit assessment");
    }
  }),
];

export const handlers = [
  ...jobsHandlers,
  ...candidatesHandlers,
  ...submissionsHandlers,
  ...assessmentsHandlers,
];
