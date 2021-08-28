"use strict";
const helpers = require("@moggiez/moggies-lambda-helpers");
const auth = require("@moggiez/moggies-auth");

const handlers = require("./handlers");

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
      if ("error" in loadtest) {
        response(500, "Internal server error.");
        return;
      }

      const playbook = await handlers.getPlaybook(request, response, loadtest);
      if ("error" in playbook) {
        response(500, "Internal server error.");
        return;
      }

      await handlers.runPlaybook(user, playbook, loadtest, response);
    } catch (exc) {
      console.log("Error: " + exc);
      response(500, "Internal server error.");
    }
  } else {
    response(403, "Not supported.");
  }
};
