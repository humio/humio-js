
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

const parseNDJSON = (text) => {
  const lines = text.split('\n');
  const last = lines.pop();

  if (last) {
    const elements = lines.map(JSON.parse);
    let remainingText;
    try {
      elements.push(JSON.parse(last));
      remainingText = "";
    } catch (e) {
      // The last item is not a complete json object.
      remainingText = last;
    }
    return { elements: elements, remainingText: remainingText };
  } else {
    return { elements: [], remainingText : "" };
  }
};

Humio.prototype.stream = function(options, onMatch) {
  if (typeof onMatch !== 'function') throw new Error("onMatch must be a function, got " + onMatch);

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
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson'
    }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (res) => {

      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
        console.log(chunk.toString());
        // Try to see if we have one or more lines
        // report them back to the caller through onMatch.

        const parseResult = parseNDJSON(body);
        parseResult.elements.forEach(onMatch);

        // Discard any JSON that has been parsed.

        body = parseResult.remainingText;
      });

      res.on("end", (x) => {
        const status = res.statusCode >= 400 ? "error" : "success";
        console.log(res.statusCode, res.statusMessage);

        const result = {
          status: status,
          statusCode: res.statusCode,
          error: null,
          data: null
        };

        if (res.statusCode >= 400) {
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

Humio.prototype.run = function(options) {
  const defaultOptions = {
    queryString: "",
    start: null,
    end: "now",
    isLive: false,
    onPartialResult: null,
  };

  options = Object.assign({}, defaultOptions, options);

  const requestBody = options;

  const requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/queryjobs",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Accept': 'application/json',
      'Connection': 'keep-alive'
    }
  };

  console.log(requestOptions);

  return doRequest(requestOptions, requestBody)
    .then((res) => {
      if (res.status === 'success') {
        return poll.call(this, res.data.id, options.onPartialResult);
      } else {
        return res;
      }
    });
};

// Private Method
function poll(jobId, onData = null) {
  const pollRequestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/queryjobs/" + encodeURIComponent(jobId),
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Accept': 'application/json',
      'Connection': 'keep-alive'
    }
  };

  const MAX_POLL_DEPLY = 1000;

  const doPoll = (resolve, reject, timeout) => {
    doRequest(pollRequestOptions).then(response => {
      if (response.status === "error") {
        reject(response.error);
      } else {
        if (onData) {
          const progress = Humio.progress(response);
          onData(response, progress);
        }
        if (response.data.done) {
          resolve(response);
        } else {
          const newTimeout = Math.min(timeout + 200, MAX_POLL_DEPLY);
          setTimeout(() => doPoll(resolve, reject, newTimeout), newTimeout);
        }
      }
    }).catch(reject);
  }

  return new Promise((resolve, reject) => {
    doPoll(resolve, reject);
  });
}


function doRequest(requestOptions, requestBody = null) {
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

    if (requestBody) {
      request.write(JSON.stringify(requestBody));
    }

    request.end();
  });
}

////////////////////////////////////////////////////////////////////////////////
// Response Helpers
////////////////////////////////////////////////////////////////////////////////

Humio.count = (result, fieldName = "_count") => {
  if (result.data.events) {
    return result.data.events[0]._count;
  } else {
    throw new Error("the count function only works for aggregate results")
  }
};

Humio.progress = (result) => {
  if (result.data.metaData.totalWork === 0) return 1;
  return result.data.metaData.workDone / result.data.metaData.totalWork;
};


////////////////////////////////////////////////////////////////////////////////
// Printers
////////////////////////////////////////////////////////////////////////////////


Humio.printResult = (result, format) => {
  format = format.toLowerCase();

  if (format === "groupby") {
    return printGroupBy(result);
  } else {
    throw new Error("Unknown print format. format=" + format);
  }
};

const padString = function(str, targetLength, padString) {
    targetLength = Math.floor(targetLength) || 0;
    if (targetLength < str.length) return String(str);

    padString = padString ? String(padString) : " ";

    var pad = "";
    var len = targetLength - str.length;
    var i = 0;
    while(pad.length < len) {
        if(!padString[i]) {
            i = 0;
        }
        pad += padString[i];
        i++;
    }

    return String(str).slice(0) + pad;
};

function printGroupBy(result) {
  if (result.data.events.length === 0) return "[ No Results ]";

  const columns = Object.keys(result.data.events[0]);
  const getColumnWidths = (event) => {
    return columns.map(column => event[column].length);
  };



  const keepMaxColumn = (acc, event) => {
    return getColumnWidths(event).map((width, i) => width >= acc[i] ? width : acc[i]);
  }

  const initialWidths = columns.map(c => c.length);
  const columnWidths = result.data.events.reduce(keepMaxColumn, initialWidths);

  const toLine = (event) => columns.reduce((line, column, i) => line + "| " + padString(event[column], columnWidths[i]) + " ", "") + "|\n";

  const header = columns.reduce((line, column, i) => line + "| " + column.padEnd(columnWidths[i]) + " ", "") + "|\n";
  const seperator = '-'.repeat(header.length - 1) + '\n';

  const output = result.data.events.reduce((out, event) => out + toLine(event), seperator + header + seperator) + seperator;

  return output;
};

module.exports = Humio;
