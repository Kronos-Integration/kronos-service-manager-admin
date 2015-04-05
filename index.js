#!/usr/bin/env iojs

/* jslint node: true, esnext: true */

"use strict";

let sm = require('service-manager');
let http = require('http');
let consul = require('consul')();


const manager = sm.manager();

const donkeyNodeServiceName = "donkey_node";
const donkeyNodeServiceId = donkeyNodeServiceName;
const donkeyNodeServiceCheckName = "donkey_node_check";
const defaultDonkeyNodeServicePort = 10000;

const donkeyNodeServiceCheck = {
  "name": donkeyNodeServiceCheckName,
  "ttl": "30s",
  "serviceid": donkeyNodeServiceId
};


registerDonkeyNodeService(function (err) {
  if (err) {
    return;
  }
  console.log(`${donkeyNodeServiceName} registerd`);

  registerDonkeyNodeCheck(function (err) {
    if (err) {
      return;
    }
    console.log(`${donkeyNodeServiceCheckName} registerd`);
  });
});



function unregisterDonkeyNodeService() {
  consul.agent.service.deregister(donkeyNodeServiceId, function (err) {
    if (err) {
      console.log(err);
      return;
    }
    console.log("deregister service");
  });
}

process.on('exit', unregisterDonkeyNodeService);

consul.status.leader(function (err, result) {
  console.log(`Leader: ${err} ${result}`);
});


function registerDonkeyNodeCheck(cb) {
  consul.agent.check.list(function (err, result) {
    if (err) {
      cb(err);
      return;
    }
    const myCheck = result[donkeyNodeServiceCheckName];

    if (myCheck) {
      console.log(
        `${donkeyNodeServiceCheckName} already defined (${myCheck.Status}): ${JSON.stringify(myCheck)}`
      );
    } else {
      consul.agent.check.register(donkeyNodeServiceCheck, cb);
    }

    cb(undefined);

    setInterval(function () {
      consul.agent.check.pass(donkeyNodeServiceCheckName, function (
        err) {
        if (err) {
          return;
        }
        consul.agent.check.list(function (err, result) {
          const myCheck = result[donkeyNodeServiceCheckName];
          if (myCheck) {
            console.log(
              `${donkeyNodeServiceCheckName} (${myCheck.Status}): ${JSON.stringify(myCheck)}`
            );
          }
        });

      });
    }, 29000);
  });
}

function registerDonkeyNodeService(cb) {

  let port = defaultDonkeyNodeServicePort;

  function donkeyNodeService() {
    let server = http.createServer(function (request, response) {
      response.writeHead(200, {
        "Content-Type": "text/html"
      });
      response.end("ok");
      console.log("check");
    });

    server.listen(port);

    console.log(`${donkeyNodeServiceName} started: port=${port}`);

    return server;
  }

  consul.agent.service.list(function (err, result) {
    if (err) {
      cb(err);
      return;
    }

    const myService = result[donkeyNodeServiceName];
    if (myService) {
      console.log(
        `${donkeyNodeServiceName} already defined Port=${myService.Port}`
      );
      console.log(
        `${donkeyNodeServiceName}: ${JSON.stringify(myService)}`
      );

      port = myService.Port;
    } else {

      consul.agent.service.register({
        "name": donkeyNodeServiceName,
        "serviceid": donkeyNodeServiceId,
        "notes": "donkey node",
        "port": port,
        "check": donkeyNodeServiceCheck,
        "tags": ["donkey"],
      }, cb);
    }

    cb(undefined, donkeyNodeService());

    //console.log(`list services: ${err} : ${JSON.stringify(result)}`);
  });
}
