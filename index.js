const crypto = require("crypto");
const https = require("https");

const defaultHost = "cloud.humio.com";
const defaultPort = 443;
const defaultDataspaceId = "sandbox";

const Humio = function Humio(options) {
  if (!options.ingestToken) {
    throw new Error("Humio ingestToken must be specified in the options.")
  }

  this.options = Object.assign({}, options);
  this.options.host = this.options.host || defaultHost;
  this.options.port = this.options.port || defaultPort;
  this.options.dataspaceId = this.options.dataspaceId || defaultDataspaceId;
  this.options.sessionId = this.options.sessionId || crypto.randomBytes(40).toString('hex');
}

Humio.prototype.sendJson = function sendJson(json) {
  this.send("json", JSON.stringify(json));
};

Humio.prototype.send = function send(parserId, message, fields, ch) {
    fields = fields || {};

    // Don't modify the input object directly.
    // Make a copy we can mess with.
    const sentFields = Object.assign({}, fields);

    for (var f in fields) {
      if (typeof fields[f] !== "string") {
        sentFields[f] = Json.stringify(fields[f]);
      }
    }

    sentFields["@session"] = sentFields["@session"] || this.options.sessionId;

    const requestBody = [
      {
        "type": parserId,
        "fields": sentFields,
        "messages": [
          message
        ]
      }
    ];

    const requestOptions = {
      host: this.options.host,
      port: this.options.port,
      path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/ingest-messages",
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.options.ingestToken
      }
    };

    const request = https.request(requestOptions);

    request.on('error', (e) => {
      console.error(e);
    });

    request.write(JSON.stringify(requestBody));
    request.end();
};

module.exports = Humio;
