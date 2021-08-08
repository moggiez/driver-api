const events = require("./events");
const { HttpClient } = require("./httpClient");
const { JobsApiClient } = require("./jobsApiClient");

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

const setLoadtestJobId = async (loadtest, jobId, http) => {
  const updatedFields = { JobId: jobId };
  return await http.put(
    `${loadtestsApiUrl}/${loadtest.OrganisationId}/${loadtest.LoadtestId}`,
    updatedFields
  );
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
      const playbookId = loadtestResponse.data.PlaybookId;
      const playbookUrl = `${playbooksApiUrl}/${orgId}/playbooks/${playbookId}`;
      const playbookResponse = await http.get(playbookUrl);

      return {
        loadtest: loadtestResponse.data,
        playbook: playbookResponse.data,
      };
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
