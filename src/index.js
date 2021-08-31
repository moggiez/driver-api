"use strict";

const AWS = require("aws-sdk");
const helpers = require("@moggiez/moggies-lambda-helpers");
const auth = require("@moggiez/moggies-auth");

const handlers = require("./handlers");
const { HttpClient } = require("./httpClient");

const DEBUG = false;

exports.handler = async function (event, context, callback) {
  const response = helpers.getResponseFn(callback);

  if (DEBUG) {
    response(200, event);
  }

  const user = auth.getUserFromEvent(event);
  const request = helpers.getRequestFromEvent(event);
  request.user = user;

  if (request.httpMethod == "POST") {
    try {
      const loadtest = await handlers.getLoadtest(request, response);
      if (!loadtest) {
        response(404, "Loadtest not found");
        return;
      }

      if ("error" in loadtest) {
        response(500, "Internal server error.");
        return;
      }

      const playbook = await handlers.getPlaybook(request, response, loadtest);
      if (!playbook) {
        response(500, "Playbook not found.");
        return;
      }

      if ("error" in playbook) {
        response(500, "Internal server error.");
        return;
      }

      const internalApiClient = new helpers.InternalApiClient({
        callerName: "driver-api",
        functionName: "domains-api",
        AWS,
      });
      const canRunResult = await handlers.canRunPlaybook(
        playbook,
        internalApiClient,
        response
      );
      if (canRunResult.result) {
        await handlers.runPlaybook(user, playbook, loadtest, response);
        return;
      } else {
        await handlers.setLoadtestState(
          loadtest,
          "FAILED",
          new HttpClient(request.user)
        );
        response(400, canRunResult.reason);
        return;
      }
    } catch (exc) {
      console.log("Error: " + exc);
      response(500, "Internal server error.");
    }
  } else {
    response(403, "Not supported.");
  }
};
