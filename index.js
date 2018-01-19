
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
  this.options.includeClientMetadata = this.options.includeClientMetadata || true;
  this.options.includeSessionId = this.options.includeSessionId || true;
}

const CLIENT_VERSION = require('./package.json').version;
const CLIENT_ID = "humio-node";

Humio.prototype.version = CLIENT_VERSION;

const defaultOptions = {
  additionalFields: {},
  tags: {},
  timestamp: null,
}

Humio.prototype.addMetadata = function addMetadata(fields) {
  if (this.options.includeSessionId) {
    fields["@session"] = fields["@session"] || this.options.sessionId;
  }

  if (this.options.includeClientMetadata) {
    fields["@client"] = CLIENT_ID;
    fields["@clientVersion"] = CLIENT_VERSION;
  }
}

Humio.prototype.sendJson = function sendJson(json, options) {
  options = Object.assign({}, defaultOptions, options);

  // Don't modify the input object directly.
  // Make a copy we can mess with.
  const sentFields = Object.assign({}, json);

  this.addMetadata(sentFields);

  const requestBody = [
    {
      "tags": {},
      "events": [
        {
          "attributes": sentFields,
          "timestamp": options.timestamp || (new Date()).toISOString()
        }
      ]
    }
  ];

  const requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/ingest",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.ingestToken
    }
  };

  const request = https.request(requestOptions, (res) => {
    // TODO: Let sendJson take a callback where you can report error.
    if (res.statusCode >= 400) {
      console.error(res.statusCode, res.statusMessage);
    }
  });

  request.on('error', (e) => {
    // TODO: Let sendJson take a callback where you can report error.
    console.error(e);
  });

  request.write(JSON.stringify(requestBody));
  request.end();
};

Humio.prototype.sendMessage = function send(parserId, message, additionalFields) {
    fields = additionalFields || {};

    // Don't modify the input object directly.
    // Make a copy we can mess with.
    const sentFields = Object.assign({}, fields);

    // Only strings are allowed.
    // TODO: Can we use nested attributes here?

    for (var f in fields) {
      if (typeof fields[f] !== "string") {
        sentFields[f] = Json.stringify(fields[f]);
      }
    }

    this.addMetadata(sentFields);

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
      // TODO: Let send take a callback where you can report error.
      console.error(e);
    });

    request.write(JSON.stringify(requestBody));
    request.end();
};

module.exports = Humio;
