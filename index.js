
const crypto = require("crypto");
const https = require("https");

const defaultHost = "cloud.humio.com";
const defaultPort = 443;
const defaultDataspaceId = "sandbox";

const Humio = function Humio(options) {
  if (!options.apiToken) {
    throw new Error("Humio apiToken must be specified in the options.")
  }

  this.options = Object.assign({}, options);
  this.options.host = this.options.host || defaultHost;
  this.options.port = this.options.port || defaultPort;
  this.options.dataspaceId = this.options.dataspaceId || defaultDataspaceId;
  this.options.sessionId = this.options.sessionId || crypto.randomBytes(40).toString('hex');
  this.options.includeClientMetadata = this.options.includeClientMetadata || true;
  this.options.includeSessionId = this.options.includeSessionId || true;
  this.options.additionalFields = this.options.additionalFields || {};

};

const CLIENT_VERSION = require('./package.json').version;
const CLIENT_ID = "humio-node";

Humio.prototype.version = CLIENT_VERSION;

Humio.prototype.addMetadata = function(fields) {
  if (this.options.includeSessionId) {
    fields["@session"] = fields["@session"] || this.options.sessionId;
  }

  if (this.options.includeClientMetadata) {
    fields["@client"] = CLIENT_ID;
    fields["@clientVersion"] = CLIENT_VERSION;
  }
}

Humio.prototype.sendJson = function(json, options) {
  const defaultOptions = {
    additionalFields: {},
    tags: {},
    timestamp: null,
  };

  options = Object.assign({}, defaultOptions, options);

  const additionalFields = Object.assign({}, this.options.additionalFields, options.additionalFields);

  // Don't modify the input object directly.
  // Make a copy we can mess with.
  const sentFields = Object.assign({}, json, additionalFields);

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
      'Authorization': 'Bearer ' + this.options.apiToken
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

Humio.prototype.sendMessage = function(parserId, message, additionalFields) {
    const fields = Object.assign({}, this.options.additionalFields, additionalFields);

    // Only strings are allowed.
    // TODO: Can we use nested attributes here?

    for (var f in fields) {
      if (typeof fields[f] !== "string") {
        fields[f] = JSON.stringify(fields[f]);
      }
    }

    this.addMetadata(fields);

    const requestBody = [
      {
        "type": parserId,
        "fields": fields,
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
        'Authorization': 'Bearer ' + this.options.apiToken
      }
    };

    const request = https.request(requestOptions, (res) => {
      // TODO: Let sendMessage take a callback where you can report error.
      if (res.statusCode >= 400) {
        console.error(res.statusCode, res.statusMessage);
      }
    });

    request.on('error', (e) => {
      // TODO: Let sendMessage take a callback where you can report error.
      console.error(e);
    });

    request.write(JSON.stringify(requestBody));
    request.end();
};

Humio.prototype.run = function(options) {
  const defaultOptions = {
    queryString: "",
    start: null,
    end: "now",
    isLive: false
  };

  options = Object.assign({}, defaultOptions, options);
  // TODO: Mention need to use API Token in docs/README

  const requestBody = options;

  const requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/query",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Accept': 'application/json',
      'Connection': 'keep-alive'
    }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (res) => {

      let chunks = [];

      res.on("data", (chunk) => {
        chunks.push(chunk.toString());
      });

      res.on("end", () => {
        const status = res.statusCode >= 400 ? "error" : "success";
        const body = chunks.join("");
        const result = {
          status: status,
          statusCode: res.statusCode,
          error: null,
          data: null
        };

        if (res.statusCode < 400) {
          try {
            result.data = JSON.parse(body);
          } catch (e) {
            // If the Json failed to parse.
            reject(e);
            return;
          }
        } else {
          result.error = body;
        }

        resolve(result);
      });
    });

    request.on('error', reject);

    request.write(JSON.stringify(requestBody));
    request.end();
  });
};

module.exports = Humio;
