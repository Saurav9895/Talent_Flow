# TalentFlow

A modern Applicant Tracking System (ATS) built with React, featuring offline capability and a mock API layer for development and demonstrations.

## Features

- Job posting and management
- Candidate tracking
- Assessment creation and management
- Drag-and-drop interface
- Offline-capable with IndexedDB
- Mock API service for development and preview

## 🧾 Taking Assessments (Quick Guide)

The application includes an assessments module that allows you to create job-specific quizzes or forms and let candidates complete them directly from their profile page.

### Quick Steps:

1. **Go to the Assessments page**

   - Navigate to the **Assessments** section from the main navigation.
   - Click **"Create New Assessment"**.

2. **Create an assessment for a job role**

   - Select the **job role** you want to associate the assessment with.
   - Add one or more **questions** — you can mix types such as:
     - Single choice
     - Multiple choice
     - Short text
     - Long text
     - Numeric (with range)
     - File upload (stub)

3. **Save the assessment**

   - Once the questions are added, click **Save Assessment**.
   - The assessment will be stored locally using **Dexie (IndexedDB)** and linked to the selected job role.

4. **Have a candidate take the assessment**

   - Navigate to the **Candidates** page and open the **candidate details** for someone who has applied to the same job role.
   - Inside the candidate profile, click **"Take Assessment"**.
   - The linked job assessment will appear; the candidate can complete and submit their responses.
   - Submissions are persisted locally in **IndexedDB**, simulating real API behavior via **MSW**.

---

💡 _Tip:_ You can preview the assessment as you build it to see how it will appear to candidates. Both builder configurations and responses are stored locally, so your progress won’t be lost on refresh.

## Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/y-saurav/Talent-Flow.git
   cd talent-flow
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture Overview

### Data Flow Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    React     │ --> │     MSW      │ --> │    Dexie     │
│  Components  │ <-- │  Mock API    │ <-- │  IndexedDB   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Key Components

1. **Frontend Layer**

   - React components with hooks for state management
   - CSS modules for styling
   - React Router for navigation
   - @dnd-kit for drag-and-drop functionality

2. **API Layer (MSW)**

   - Mock Service Worker intercepts network requests
   - Simulates RESTful API endpoints
   - Provides consistent API behavior across environments
   - Enables offline functionality and demos

   # TalentFlow

   A modern Applicant Tracking System (ATS) built with React. TalentFlow is designed to be offline friendly (IndexedDB) and developer-friendly (MSW for API mocking). This README explains how to set up the project, the architecture pattern (MSW + Dexie), testing, deployment, and the rationale behind major design choices.

   ***

   ## Table of Contents

   - Quick start
   - Architecture overview (MSW + Dexie pattern)
   - Known issues & limitations
   - Testing instructions
   - Deployment steps
   - Decisions & rationale (Why Dexie, Why MSW, optimistic updates)
   - Contributing
   - License

   ***

   ## Quick start

   1. Clone the repository:

   ```powershell
   git clone https://github.com/y-saurav/Talent-Flow.git
   cd talent-flow
   ```

   2. Install dependencies:

   ```powershell
   npm install
   ```

   3. Start the development server (MSW and Dexie seeding enabled by default):

   ```powershell
   npm start
   ```

   4. Open your browser at http://localhost:3000

   Notes:

   - The app uses Mock Service Worker (MSW) to simulate API endpoints during development. Handlers live in `src/mocks/`.
   - The local persistent storage is `IndexedDB` via Dexie; initial seed logic is in `src/db/init.js`.

   ***

   ## Architecture overview (MSW + Dexie pattern)

   At a high level the pattern in this project is:

   1. UI components issue standard network requests (fetch/XHR) to `/api/...` endpoints.
   2. MSW intercepts those network calls in the browser and routes them to handler code defined under `src/mocks/handlers.js`.
   3. MSW handlers call into the local data layer (the Dexie-based modules under `src/db/`) to read/write data in IndexedDB.

   This keeps component code simple (they just call REST endpoints) and centralizes persistence and business logic in the Dexie layer while providing a realistic API for development and tests.

   ASCII flow:

   ```
   React UI  --fetch-->  /api/*  --intercepted by-->  MSW handlers  --calls-->  Dexie (IndexedDB)
   ```

   Key files:

   - `src/mocks/handlers.js` — MSW request handlers that simulate RESTful endpoints
   - `src/mocks/browser.js` — MSW setup / worker registration for the browser
   - `src/db/schema.js` — Dexie schema definitions
   - `src/db/init.js` — DB initialization and optional seeding
   - `src/db/api.js` — Higher-level database helper functions used by handlers/components

   Why this pattern is useful:

   - Components remain network-oriented (no direct IndexedDB code in many components).
   - Handlers expose a stable API surface for integration tests and demos.
   - Dexie centralizes persistence logic, migrations and transactions.

   ***

   ## Known issues & limitations

   These are areas to be aware of while developing and deploying:

   - IndexedDB storage quota varies by browser and OS. Large attachments are not recommended.
   - MSW runs in the browser (or in node for tests). If you switch to a real backend, you must remove or disable the worker registration.
   - Sync conflicts: if the same data is updated in two places (different tabs or a remote backend), conflict resolution is basic and may require manual handling.
   - Some browsers (older versions) have incomplete IndexedDB implementations which can cause unexpected behavior.
   - Migration logic must be updated carefully when changing `src/db/schema.js` to avoid data loss.
   - MSW persistence is per-origin; clearing site data will remove the DB.

   If you see intermittent write errors during create/edit operations, check the browser console and `src/db/errors.js` for retry logic and error wrapping. The app implements a retry/backoff for some write flows but it is not guaranteed to fix every case (e.g., storage full).

   ***

   ## Testing instructions

   Unit tests and integration tests are configured to run with MSW so they don't require a remote backend.

   1. Run unit tests (Jest + React Testing Library):

   ```powershell
   npm test
   ```

   2. Run integration tests (if provided):

   ```powershell
   npm run test:integration
   ```

   3. Run E2E tests (if you have a Cypress / Playwright setup):

   ```powershell
   npm run test:e2e
   ```

   Notes on test environment:

   - Tests use the handlers in `src/mocks/` and a Node MSW server (see `src/mocks/browser.js` and `src/mocks/server.js` if present).
   - If tests fail due to DB state, try clearing the browser IndexedDB or run the test runner in a fresh browser context.

   ***

   ## Deployment

   The project is a static SPA and can be deployed to any static host. By default the app registers MSW in the browser — for a real backend deployment you should remove or disable the worker.

   1. Create a production build:

   ```powershell
   npm run build
   ```

   2. Serve locally to smoke-test the build:

   ```powershell
   npm install -g serve
   serve -s build
   ```

   3. Deploy to a hosting provider (pick one):

   - Vercel / Netlify: connect the repo and use the `build` command `npm run build`. Configure redirect rules to route all paths to `index.html` (SPA fallback).
   - GitHub Pages: use `gh-pages` or CI to push `build/` contents to the gh-pages branch.
   - Container: create a minimal static server in a Dockerfile and push to your registry.

   Disabling MSW in production:

   - Option A (recommended): Update the app entrypoint to only register MSW in non-production mode. For example, in `src/index.js`:

   ```js
   if (process.env.NODE_ENV !== "production") {
     const { worker } = require("./mocks/browser");
     worker.start();
   }
   ```

   - Option B: Remove/disable the `src/mocks` registration entirely and replace endpoints with real API URLs.

   If you want a demo site that keeps the mocked behavior for preview, you can leave MSW enabled for that environment — but document that the demo is mocked.

   ***

   ## Decisions & rationale

   Why Dexie?

   - Dexie is a small, well-tested wrapper around IndexedDB that provides a Promise-based API, query helpers, and migration and transaction utilities. It significantly simplifies working with IndexedDB compared to raw API calls, improving developer productivity and reducing error-prone boilerplate.

   Why MSW?

   - MSW provides a realistic network surface for the application while running entirely in the browser. Compared to stubbing fetch calls inside components or wiring up a temporary backend, MSW lets us:
     - Keep component code unchanged (they call HTTP endpoints)
     - Simulate failures and latency for robust testing
     - Reuse handlers across tests and the browser

   Optimistic updates strategy

   - The UI performs optimistic updates for common flows (create, edit, archive, reorder). Strategy summary:

     1. Update UI immediately so the app feels fast.
     2. Perform the persistence operation (Dexie write/transaction) in the background.
     3. If the write fails, rollback the UI change and surface an error toast.
     4. For offline scenarios, queue the operation and retry automatically when connectivity returns.

   - This approach balances UX and safety: users see immediate feedback while the app retains a clear rollback path.

   ***
