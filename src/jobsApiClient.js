"use strict";

const { HttpClient } = require("./httpClient");

const usersApiUrl = "https://users-api.moggies.io";
const jobsApiUrl = "https://jobs-api.moggies.io";

class JobsApiClient {
  constructor(user) {
    this.http = new HttpClient(user);
    this.user = user;
    this.organisationId = null;
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
    const newJobUrl = `${jobsApiUrl}/${orgId}/jobs`;
    const payload = data;
    if ("TaskId" in data) {
      delete data["TaskId"];
    }
    return this.http.post(newJobUrl, payload);
  }

  async createTask(jobId, data) {
    const orgId = await this._getOrganisationId();
    const newJobUrl = `${jobsApiUrl}/${orgId}/jobs/${jobId}/tasks`;
    const payload = data;
    if ("TaskId" in data) {
      delete data["TaskId"];
    }
    return this.http.post(newJobUrl, payload);
  }
}

exports.JobsApiClient = JobsApiClient;
