"use strict";

const uuid = require("uuid");

class JobsApiClient {
  constructor(user, internalJobsApi, internalUsersApi) {
    this.user = user;
    this.organisationId = null;
    this.internalJobsApi = internalJobsApi;
    this.internalUsersApi = internalUsersApi;
    this.tasks = [];
  }

  async _getOrganisationId() {
    if (this.organisationId != null) {
      return this.organisationId;
    }

    const org = await this.internalUsersApi.invoke("getUserOrganisation", {
      userId: this.user.id,
    });
    if (org != null) {
      this.organisationId = org.OrganisationId;
      return this.organisationId;
    } else {
      throw new Error("User organisation could not be retrieved.");
    }
  }

  async createJob(data) {
    const orgId = await this._getOrganisationId();
    const finalData = { ...data, OrganisationId: orgId };
    const jobId = uuid.v4();
    await this.internalJobsApi.invoke("createJob", {
      jobId: jobId,
      data: finalData,
    });
    return jobId;
  }

  async addTask(jobId, data) {
    const orgId = await this._getOrganisationId();
    const taskId = uuid.v4();
    const taskData = {
      ...data,
      OrganisationId: orgId,
      JobId: jobId,
      TaskId: taskId,
    };
    this.tasks.push(taskData);
    return taskId;
  }

  async createTasks() {
    await this.internalJobsApi.invoke("batchCreate", {
      records: this.tasks,
    });
    this.tasks.splice(0, this.tasks.length);
  }
}

exports.JobsApiClient = JobsApiClient;
