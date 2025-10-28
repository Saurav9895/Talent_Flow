import { db } from "../schema";
import {
  companies,
  locations,
  jobTypes,
  skillSets,
  jobTitles,
  jobDescriptionTemplates,
  firstNames,
  lastNames,
  universities,
  previousCompanies,
  assessmentTemplates,
} from "./data";

// Utility functions for random selections
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

// Generate a job with realistic data
const generateJob = () => {
  const domain = getRandomItem([
    "frontend",
    "backend",
    "devops",
    "mobile",
    "data",
  ]);
  const skills = getRandomItems(skillSets[domain], getRandomInt(4, 8));
  const title = getRandomItem(jobTitles[domain]);
  const description = getRandomItem(jobDescriptionTemplates)
    .replace("{role}", title)
    .replace("{skills}", skills.join(", "));

  return {
    title,
    company: getRandomItem(companies),
    location: getRandomItem(locations),
    type: getRandomItem(jobTypes),
    description,
    requirements: skills,
    isArchived: Math.random() > 0.8, // 20% chance of being archived
    createdAt: getRandomDate(new Date(2023, 0, 1), new Date()),
  };
};

// Generate a candidate with realistic data
const generateCandidate = () => {
  const firstName = getRandomItem(firstNames);
  const lastName = getRandomItem(lastNames);
  const domain = getRandomItem([
    "frontend",
    "backend",
    "devops",
    "mobile",
    "data",
  ]);
  const skills = getRandomItems(skillSets[domain], getRandomInt(3, 7));

  return {
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    phone: `+1${Math.floor(Math.random() * 1000000000)
      .toString()
      .padStart(10, "0")}`,
    location: getRandomItem(locations),
    education: {
      university: getRandomItem(universities),
      degree: `${getRandomItem(["BS", "MS", "PhD"])} in ${getRandomItem([
        "Computer Science",
        "Software Engineering",
        "Information Technology",
      ])}`,
      graduationYear: getRandomInt(2015, 2023),
    },
    experience: getRandomInt(1, 15),
    currentCompany: getRandomItem(previousCompanies),
    skills,
    createdAt: getRandomDate(new Date(2023, 0, 1), new Date()),
  };
};

// Generate an assessment with realistic questions
const generateAssessment = (jobId) => {
  const assessmentTypes = Object.keys(assessmentTemplates);
  const numQuestions = getRandomInt(10, 15);
  const questions = [];

  for (let i = 0; i < numQuestions; i++) {
    const type = getRandomItem(assessmentTypes);
    const questionTemplate = getRandomItem(assessmentTemplates[type]);
    questions.push({
      ...questionTemplate,
      id: i + 1,
    });
  }

  return {
    jobId,
    title: `Assessment for Job #${jobId}`,
    description:
      "Complete this assessment to demonstrate your skills and qualifications.",
    timeLimit: getRandomInt(30, 120), // minutes
    questions,
    createdAt: getRandomDate(new Date(2023, 0, 1), new Date()),
  };
};

// Generate applications linking candidates to jobs
const generateApplications = (candidateIds, jobIds) => {
  const applications = [];
  const numApplications = getRandomInt(1500, 2000); // Ensure good distribution

  for (let i = 0; i < numApplications; i++) {
    const candidateId = getRandomItem(candidateIds);
    const jobId = getRandomItem(jobIds);

    // Avoid duplicate applications
    const key = `${candidateId}-${jobId}`;
    if (
      !applications.some((app) => `${app.candidateId}-${app.jobId}` === key)
    ) {
      applications.push({
        candidateId,
        jobId,
        status: getRandomItem(["pending", "completed", "reviewed"]),
        stage: getRandomItem([
          "applied",
          "screening",
          "phone_screen",
          "interview",
          "offer",
          "hired",
          "rejected",
        ]),
        createdAt: getRandomDate(new Date(2023, 0, 1), new Date()),
      });
    }
  }

  return applications;
};

// Main seeding function
export const seedDatabase = async () => {
  try {
    // Clear existing data
    await db.delete();
    await db.open();

    // Generate and insert 25 jobs
    const jobs = Array.from({ length: 25 }, generateJob);
    const jobIds = await db.jobs.bulkAdd(jobs, { allKeys: true });

    // Generate and insert 1000 candidates
    const candidates = Array.from({ length: 1000 }, generateCandidate);
    const candidateIds = await db.candidates.bulkAdd(candidates, {
      allKeys: true,
    });

    // Generate and insert 3-5 assessments per job
    const assessments = [];
    for (const jobId of jobIds) {
      const numAssessments = getRandomInt(3, 5);
      for (let i = 0; i < numAssessments; i++) {
        assessments.push(generateAssessment(jobId));
      }
    }
    await db.assessments.bulkAdd(assessments);

    // Generate and insert submissions (applications)
    const submissions = generateApplications(candidateIds, jobIds);
    await db.submissions.bulkAdd(submissions);

    console.log("Database seeded successfully!");
    console.log(`Created:
    - ${jobs.length} jobs
    - ${candidates.length} candidates
    - ${assessments.length} assessments
    - ${submissions.length} submissions`);
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
};
