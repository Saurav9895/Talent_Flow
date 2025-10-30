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
   git clone https://github.com/Saurav9895/Talent_Flow.git
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
   git clone https://github.com/Saurav9895/Talent_Flow.git
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

