const helpers = require("@moggiez/moggies-lambda-helpers");
const events = require("./events");
const { parseDomain, ParseResultType } = require("parse-domain");
const { JobsApiClient } = require("./jobsApiClient");

const FREE_QUOTA_USERS = 100;
const FREE_QUOTA_CALLS = 500;

class Handler {
  constructor({ AWS, response }) {
    this.response = response;
    this.internalJobsApi = new helpers.InternalApiClient({
      callerName: "driver-api",
      functionName: "jobs-api",
      AWS,
    });
    this.internalDomainsApi = new helpers.InternalApiClient({
      callerName: "driver-api",
      functionName: "domains-api",
      AWS,
    });
  }

  canRunPlaybookStep = async (step, organisationValidDomains) => {
    const stepHostname = step.requestOptions.hostname;
    const parseResult = parseDomain(stepHostname);
    if (parseResult.type === ParseResultType.Listed) {
      const { domain, topLevelDomains } = parseResult;
      const stepDomain = `${domain}.${topLevelDomains.join(".")}`;
      const matchingDomains = organisationValidDomains.Items.filter(
        (domain) => domain.DomainName === stepDomain
      );

      // TODO remove moggies.io as always allowed
      if (matchingDomains.length < 1 && stepDomain !== "moggies.io") {
        throw `Cannot run step: hostname ${stepHostname} is not allowed.`;
      }
    } else {
      // In the future we can add handling for ParseResultType.Ip
      throw `Cannot run step: hostname ${stepHostname} is not allowed.`;
    }
  };

  validateQuota = (step) => {
    if (step.users > FREE_QUOTA_USERS) {
      throw `Maximum number of users (${FREE_QUOTA_USERS}) exceeded. This limitation applies to the Free Plan.`;
    }

    const quota = step.users * step.repeats;
    if (quota > FREE_QUOTA_CALLS) {
      throw `Maximum number of http calls (${FREE_QUOTA_CALLS}) exceeded. This limitation applies to the Free Plan.`;
    }
    if (quota < 10) {
      throw "Minimum number of http calls is 10.";
    }
  };

  canRunPlaybook = async (playbook) => {
    try {
      const domainsData = await this.internalDomainsApi.invoke(
        "getOrganisationValidDomains",
        { organisationId: playbook.OrganisationId }
      );
      for (const idx in playbook.Steps) {
        const step = playbook.Steps[idx];
        this.validateQuota(step);
        await this.canRunPlaybookStep(step, domainsData);
      }
      return { result: true };
    } catch (err) {
      return { result: false, reason: err };
    }
  };

  runPlaybook = async (user, playbook, loadtest, jobId) => {
    const jobsApi = new JobsApiClient(user, this.internalJobsApi);
    const detail = playbook.Steps[0];
    const usersCount = detail["users"];
    const userCallParams = { ...detail };
    delete userCallParams["users"];

    const userCallTemplate = {
      customerId: loadtest.OrganisationId,
      loadtestId: loadtest.LoadtestId,
      jobId,
      user,
      eventParams: userCallParams,
    };
    let i = 0;
    let userInvertedIndex = usersCount - i;
    while (i < usersCount) {
      const taskId = await jobsApi.addTask(jobId, {});
      const userCall = {
        ...userCallTemplate,
        taskId,
        userInvertedIndex,
      };
      events.addUserCall(userCall);

      if (i % 10 === 9) {
        await jobsApi.createTasks();
        await events.triggerUserCalls();
      }
      i++;
      userInvertedIndex = usersCount - i;
    }
    await events.triggerUserCalls();
  };
}

exports.Handler = Handler;
