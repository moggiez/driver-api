"use strict";

const uuid = require("uuid");
const { HttpClient } = require("./httpClient");

const usersApiUrl = "https://users-api.moggies.io";
const jobsApiUrl = "https://jobs-api.moggies.io";

class JobsApiClient {
  constructor(user, internalApiClient) {
    this.http = new HttpClient(user);
    this.user = user;
    this.organisationId = null;
    this.internalApiClient = internalApiClient;
    this.tasks = [];
  }

  async _getOrganisationId() {
    if (this.organisationId != null) {
      return this.organisationId;
    }

    const usersResponse = await this.http.get(`${usersApiUrl}/${this.user.id}`);
    if (
      usersResponse.status != 200 ||
      !("OrganisationId" in usersResponse.data)
    ) {
      throw new Error("User organisation could not be retrieved.");
    }
    return usersResponse.data.OrganisationId;
  }

  async createJob(data) {
    const orgId = await this._getOrganisationId();
    const finalData = { ...data, OrganisationId: orgId };
    const jobId = uuid.v4();
    await this.internalApiClient.invoke("createJob", {
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
    await this.internalApiClient.invoke("batchCreate", {
      records: this.tasks,
    });
    this.tasks.splice(0, this.tasks.length);
  }
}

exports.JobsApiClient = JobsApiClient;
