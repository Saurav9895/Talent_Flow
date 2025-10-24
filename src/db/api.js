import { db, jobs, candidates, assessments, submissions } from "./schema";

// Jobs CRUD
export const jobsApi = {
  async getAll() {
    return await jobs.toArray();
  },

  async getById(id) {
    return await jobs.get(id);
  },

  async add(job) {
    return await jobs.add(job);
  },

  async update(id, changes) {
    return await jobs.update(id, changes);
  },

  async delete(id) {
    return await jobs.delete(id);
  },

  async search(query) {
    return await jobs
      .filter(
        (job) =>
          job.title.toLowerCase().includes(query.toLowerCase()) ||
          job.company.toLowerCase().includes(query.toLowerCase())
      )
      .toArray();
  },
};

// Candidates CRUD
export const candidatesApi = {
  async getAll() {
    return await candidates.toArray();
  },

  async getById(id) {
    return await candidates.get(id);
  },

  async add(candidate) {
    return await candidates.add(candidate);
  },

  async update(id, changes) {
    return await candidates.update(id, changes);
  },

  async delete(id) {
    return await candidates.delete(id);
  },

  async search(query) {
    return await candidates
      .filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(query.toLowerCase()) ||
          candidate.email.toLowerCase().includes(query.toLowerCase()) ||
          candidate.skills.some((skill) =>
            skill.toLowerCase().includes(query.toLowerCase())
          )
      )
      .toArray();
  },
};

// Assessments CRUD
export const assessmentsApi = {
  async getAll() {
    return await assessments.toArray();
  },

  async getById(id) {
    return await assessments.get(id);
  },

  async add(assessment) {
    return await assessments.add(assessment);
  },

  async update(id, changes) {
    return await assessments.update(id, changes);
  },

  async delete(id) {
    return await assessments.delete(id);
  },

  async search(query) {
    return await assessments
      .filter(
        (assessment) =>
          assessment.title.toLowerCase().includes(query.toLowerCase()) ||
          assessment.skills.some((skill) =>
            skill.toLowerCase().includes(query.toLowerCase())
          )
      )
      .toArray();
  },
};

// Submissions CRUD
export const submissionsApi = {
  async getAll() {
    return await submissions.toArray();
  },

  async getById(id) {
    return await submissions.get(id);
  },

  async add(submission) {
    return await submissions.add(submission);
  },

  async update(id, changes) {
    return await submissions.update(id, changes);
  },

  async delete(id) {
    return await submissions.delete(id);
  },

  async getByCandidate(candidateId) {
    return await submissions.where("candidateId").equals(candidateId).toArray();
  },

  async getByJob(jobId) {
    return await submissions.where("jobId").equals(jobId).toArray();
  },

  async getByAssessment(assessmentId) {
    return await submissions
      .where("assessmentId")
      .equals(assessmentId)
      .toArray();
  },
};
