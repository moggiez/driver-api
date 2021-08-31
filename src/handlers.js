const events = require("./events");
const { HttpClient } = require("./httpClient");
const { JobsApiClient } = require("./jobsApiClient");
const { parseDomain, ParseResultType } = require("parse-domain");

const loadtestStates = {
  STARTED: "Started",
  RUNNING: "Running",
  COMPLETED: "Completed",
  ABORTED: "Aborted",
};

const usersApiUrl = "https://users-api.moggies.io";
const loadtestsApiUrl = "https://loadtests-api.moggies.io";
const playbooksApiUrl = "https://playbooks-api.moggies.io";

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

const setLoadtestState = async (loadtest, newState, http) => {
  const updated = { ...loadtest };
  delete updated.OrganisationId;
  delete updated.LoadtestId;
  updated["CurrentState"] = newState;
  if (newState == loadtestStates.STARTED) {
    updated["StartDate"] = new Date().toISOString();
  } else if (
    newState == loadtestStates.COMPLETED ||
    newState == loadtestStates.ABORTED
  ) {
    updated["EndDate"] = new Date().toISOString();
  }
  return await http.put(
    `${loadtestsApiUrl}/${loadtest.OrganisationId}/${loadtest.LoadtestId}`,
    updated
  );
};

exports.setLoadtestState = setLoadtestState;

const setLoadtestJobId = async (loadtest, jobId, http) => {
  const updatedFields = { JobId: jobId };
  return await http.put(
    `${loadtestsApiUrl}/${loadtest.OrganisationId}/${loadtest.LoadtestId}`,
    updatedFields
  );
};

const canRunPlaybookStep = async (step, organisationValidDomains) => {
  const stepHostname = step.requestOptions.hostname;
  const parseResult = parseDomain(stepHostname);
  if (parseResult.type === ParseResultType.Listed) {
    const { domain, topLevelDomains } = parseResult;
    const stepDomain = `${domain}.${topLevelDomains.join(".")}`;
    const matchingDomains = organisationValidDomains.Items.filter(
      (domain) => domain.DomainName === stepDomain
    );
    return matchingDomains.length > 0;
  } else {
    // In the future we can add handling for ParseResultType.Ip
    return false;
  }
};

exports.canRunPlaybook = async (playbook, internalApiClient) => {
  try {
    const domainsData = await internalApiClient.invoke(
      "getOrganisationValidDomains",
      { organisationId: playbook.OrganisationId }
    );
    for (const idx in playbook.Steps) {
      const step = playbook.Steps[idx];
      const canRunStep = await canRunPlaybookStep(step, domainsData);
      if (!canRunStep) {
        return {
          result: false,
          reason: `Cannot run step: hostname ${step.requestOptions.hostname} is not allowed.`,
        };
      }
    }
    return { result: true };
  } catch (err) {
    return { result: false, reason: err };
  }
};

exports.getPlaybook = async (request, response, loadtest) => {
  const http = new HttpClient(request.user);
  try {
    const playbookIdVersion = loadtest.PlaybookId;
    const segments = playbookIdVersion.split(":");
    let playbookId = null;
    let playbookVersion = null;
    if (segments.length == 2) {
      playbookId = segments[0];
      playbookVersion = segments[1];
    } else {
      playbookId = playbookIdVersion;
    }

    let playbookUrl = `${playbooksApiUrl}/${loadtest.OrganisationId}/playbooks/${playbookId}`;
    if (playbookVersion !== null) {
      playbookUrl = `${playbookUrl}/versions/v${playbookVersion}`;
    }
    const playbookResponse = await http.get(playbookUrl);

    if (playbookResponse.status == 200) {
      return playbookResponse.data;
    } else {
      return { error: playbookResponse.data };
    }
  } catch (exc) {
    console.log("Error: " + exc);
    response(500, "Internal server error.");
  }
};

exports.getLoadtest = async (request, response) => {
  const http = new HttpClient(request.user);

  try {
    const loadtestId = request.pathParameters.loadtestId;
    const orgId = await getOrganisationId(request.user, response);
    if (orgId !== request.pathParameters.organisationId) {
      response(401, "Unauthorized");
    }

    const loadtestUrl = `${loadtestsApiUrl}/${orgId}/${loadtestId}`;
    const loadtestResponse = await http.get(loadtestUrl);

    if (loadtestResponse.status == 200) {
      return loadtestResponse.data;
    } else {
      return { error: loadtestResponse.data };
    }
  } catch (exc) {
    console.log("Error: " + exc);
    response(500, "Internal server error.");
  }
};

exports.runPlaybook = async (user, playbook, loadtest, response) => {
  const http = new HttpClient(user);
  const jobsApi = new JobsApiClient(user);

  const detail = playbook.Steps[0];
  const usersCount = detail["users"];
  const userCallParams = { ...detail };
  delete userCallParams["users"];

  const startResponse = await setLoadtestState(
    loadtest,
    loadtestStates.STARTED,
    http
  );

  const jobData = await jobsApi.createJob({});
  const jobId = jobData.data.JobId;
  await setLoadtestJobId(loadtest, jobId, http);
  if (startResponse.status == 200) {
    try {
      let i = 0;
      let userInvertedIndex = usersCount - i;
      while (i < usersCount) {
        const taskData = await jobsApi.createTask(jobId, {});
        events.addUserCall(
          loadtest.OrganisationId,
          loadtest.LoadtestId,
          taskData.data.JobId,
          taskData.data.TaskId,
          user,
          userCallParams,
          userInvertedIndex
        ); // mark user index
        if (i % 10 === 0) {
          await events.triggerUserCalls();
        }
        i++;
        userInvertedIndex = usersCount - i;
      }
      await events.triggerUserCalls();
      const setResponse = await setLoadtestState(
        loadtest,
        loadtestStates.RUNNING,
        http
      );
      response(200, setResponse.data);
    } catch (exc) {
      console.log("Error: " + exc);
      response(500, "Internal server error.");
    }
  } else {
    response(500, "Error starting loadtets.");
  }
};
