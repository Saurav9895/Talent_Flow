import { db, jobs, candidates, assessments } from "./schema";

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
  const { jobCount = 10, candidateCount = 20, assessmentCount = 5 } = config;

  // Check if database is empty
  const [jobsCount, candidatesCount, assessmentsCount] = await Promise.all([
    jobs.count(),
    candidates.count(),
    assessments.count(),
  ]);

  if (jobsCount > 0 || candidatesCount > 0 || assessmentsCount > 0) {
    console.log("Database already contains data, skipping seed");
    return;
  }

  // Generate mock data
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

  const candidatesData = Array.from({ length: candidateCount }, (_, i) => ({
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
    await db.transaction("rw", [jobs, candidates, assessments], async () => {
      await Promise.all([
        jobs.bulkAdd(jobsData),
        candidates.bulkAdd(candidatesData),
        assessments.bulkAdd(assessmentsData),
      ]);
    });
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Failed to seed database:", error);
    throw error;
  }
}
