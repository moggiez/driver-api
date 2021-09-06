"use strict";

const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();
const eventTypes = require("./eventTypes");

const EVENT_SOURCE = "Driver";
const EVENT_BUS_NAME = "moggiez-load-test";
const SUCCESS_MSG_HTTP_RESP = "Successfully called Moggiez Driver";

const params = {
  Entries: [],
};

exports.addUserCall = ({
  customerId,
  loadtestId,
  jobId,
  taskId,
  user,
  eventParams,
  userInvertedIndex,
}) => {
  const event = {
    Source: EVENT_SOURCE,
    DetailType: eventTypes.USER_CALLS_EVENT_TYPE,
    Detail: JSON.stringify({
      ...eventParams,
      customerId,
      loadtestId,
      jobId,
      taskId,
      userId: user.id,
      user,
      userInvertedIndex,
    }),
    EventBusName: EVENT_BUS_NAME,
  };
  params.Entries.push(event);
};

exports.triggerUserCalls = () => {
  return new Promise((resolve, reject) => {
    if (params.Entries.length > 0) {
      eventbridge.putEvents(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          if (data.FailedEntryCount == 0) {
            const message = {
              triggeredRule: data.RuleArn,
              message: SUCCESS_MSG_HTTP_RESP,
            };
            params.Entries.splice(0, params.Entries.length);
            resolve(message);
          } else {
            const errPayload = {
              data: data,
            };
            reject(errPayload);
          }
        }
      });
    } else {
      resolve(SUCCESS_MSG_HTTP_RESP);
    }
  });
};
