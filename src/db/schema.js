import Dexie from "dexie";

// Define types as JSDoc comments for better IDE support
/**
 * @typedef {Object} Job
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string} company
 * @property {string} location
 * @property {string} type - 'full-time' | 'part-time' | 'contract'
 * @property {Date} postedDate
 * @property {string} status - 'open' | 'closed'
 */

/**
 * @typedef {Object} Candidate
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} resume
 * @property {string[]} skills
 * @property {Date} registrationDate
 */

/**
 * @typedef {Object} Assessment
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string} type - 'technical' | 'personality' | 'language'
 * @property {number} duration - in minutes
 * @property {string[]} skills
 * @property {Date} createdAt
 */

/**
 * @typedef {Object} Submission
 * @property {number} id
 * @property {number} candidateId
 * @property {number} jobId
 * @property {number} assessmentId
 * @property {number} score
 * @property {string} status - 'pending' | 'completed' | 'reviewed'
 * @property {Date} submittedAt
 */

class TalentFlowDB extends Dexie {
  constructor() {
    super("TalentFlowDB");

    this.version(1).stores({
      jobs: "++id, title, company, status, postedDate",
      candidates: "++id, name, email, registrationDate",
      assessments: "++id, title, type, createdAt",
      submissions:
        "++id, candidateId, jobId, assessmentId, status, submittedAt",
    });
  }
}

export const db = new TalentFlowDB();

// Add type information to tables
/** @type {Dexie.Table<Job, number>} */
export const jobs = db.table("jobs");

/** @type {Dexie.Table<Candidate, number>} */
export const candidates = db.table("candidates");

/** @type {Dexie.Table<Assessment, number>} */
export const assessments = db.table("assessments");

/** @type {Dexie.Table<Submission, number>} */
export const submissions = db.table("submissions");

export default db;
