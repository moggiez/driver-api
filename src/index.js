"use strict";

const AWS = require("aws-sdk");
const helpers = require("@moggiez/moggies-lambda-helpers");
const auth = require("@moggiez/moggies-auth");
const { HttpClient } = require("./httpClient");
const { JobsApiClient } = require("./jobsApiClient");

const { Handler } = require("./handler");

const DEBUG = false;

const internalJobsApi = new helpers.InternalApiClient({
  callerName: "driver-api",
  functionName: "jobs-api",
  AWS,
});

const internalLoadtestsApi = new helpers.InternalApiClient({
  callerName: "driver-api",
  functionName: "loadtests-api",
  AWS,
});

const internalPlaybooksApi = new helpers.InternalApiClient({
  callerName: "driver-api",
  functionName: "playbooks-api",
  AWS,
});

const usersApiUrl = "https://users-api.moggies.io";
const getOrganisationId = async (user, response) => {
  const http = new HttpClient(user);
  const usersResponse = await http.get(`${usersApiUrl}/${user.id}`);
  if (
    usersResponse.status != 200 ||
    !("OrganisationId" in usersResponse.data)
  ) {
    response(404, "Not found.");
  }

  return usersResponse.data.OrganisationId;
};

const getPlaybook = async (loadtest) => {
  const playbookIdVersion = loadtest.PlaybookId;
  const segments = playbookIdVersion.split(":");
  let playbookId = null;
  let version = null;
  if (segments.length == 2) {
    playbookId = segments[0];
    version = `v${segments[1]}`;
  } else {
    playbookId = playbookIdVersion;
  }
  return internalPlaybooksApi.invoke("getPlaybook", {
    organisationId: loadtest.OrganisationId,
    playbookId,
    version,
  });
};

const abortLoadtest = async (loadtest, reason) => {
  await internalLoadtestsApi.invoke("updateLoadtest", {
    organisationId: loadtest.OrganisationId,
    loadtestId: loadtest.LoadtestId,
    updatedFields: {
      CurrentState: "ABORTED",
      CurrentStateDetail: JSON.stringify(reason),
    },
  });
};

exports.handler = async function (event, context, callback) {
  const response = helpers.getResponseFn(callback);

  if (DEBUG) {
    response(200, event);
  }

  const user = auth.getUserFromEvent(event);
  const request = helpers.getRequestFromEvent(event);
  request.user = user;

  if (request.httpMethod == "POST") {
    // FETCH NECESSARY DATA
    const orgId = await getOrganisationId(user);
    const loadtest = await internalLoadtestsApi.invoke("getLoadtest", {
      organisationId: orgId,
      loadtestId: request.pathParameters.loadtestId,
    });
    if (!loadtest) {
      response(404, "Loadtest not found");
      return;
    }

    if ("error" in loadtest) {
      response(500, "Internal server error.");
      return;
    }

    const playbook = await getPlaybook(loadtest);
    if (!playbook) {
      response(404, "Playbook not found");
      return;
    }

    const jobsApi = new JobsApiClient(user, internalJobsApi);
    const jobId = await jobsApi.createJob({});

    // UPDATED LOADTEST
    await internalLoadtestsApi.invoke("updateLoadtest", {
      organisationId: loadtest.OrganisationId,
      loadtestId: loadtest.LoadtestId,
      updatedFields: {
        JobId: jobId,
        CurrentState: "STARTED",
        StartDate: new Date().toISOString(),
      },
    });

    // RUN PLAYBOOK
    try {
      const handler = new Handler({ AWS, response });
      try {
        await handler.canRunPlaybook(playbook);
      } catch (err) {
        await abortLoadtest(loadtest, err);
        response(400, err);
      }

      await handler.runPlaybook(user, playbook, loadtest, jobId);

      // UPDATED LOADTEST
      await internalLoadtestsApi.invoke("updateLoadtest", {
        organisationId: loadtest.OrganisationId,
        loadtestId: loadtest.LoadtestId,
        updatedFields: {
          CurrentState: "RUNNING",
        },
      });
      response(200, { LoadtestId: loadtest.LoadtestId });
    } catch (err) {
      // UPDATED LOADTEST
      console.log(err);
      await abortLoadtest(loadtest, err);
      response(500, err);
    }
  }
};
