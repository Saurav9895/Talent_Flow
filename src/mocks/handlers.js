import { http, HttpResponse } from "msw";
import { jobsApi, candidatesApi, assessmentsApi } from "../db/api";
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

    try {
      let items = search ? await api.search(search) : await api.getAll();

      // Filter by archive status for jobs
      if (path === "/api/jobs") {
        items = items.filter((item) =>
          showArchived ? item.status === "archived" : item.status !== "archived"
        );
      }

      const start = (page - 1) * limit;
      const paginatedItems = items.slice(start, start + limit);

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
      const item = await api.getById(parseInt(params.id));
      if (!item) {
        return new HttpResponse(null, { status: 404 });
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
      const id = parseInt(params.id);

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
  createPatchHandler("/api/candidates", candidatesApi),
];

// Assessments handlers
const assessmentsHandlers = [
  createGetCollectionHandler("/api/assessments", assessmentsApi),
  createGetItemHandler("/api/assessments", assessmentsApi),
  createPostHandler("/api/assessments", assessmentsApi),
  createPatchHandler("/api/assessments", assessmentsApi),
];

export const handlers = [
  ...jobsHandlers,
  ...candidatesHandlers,
  ...assessmentsHandlers,
];
