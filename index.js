var crypto = require("crypto");
var https = require("https");
var http = require("http");

var defaultHost = "cloud.humio.com";
var defaultPort = 443;
var defaultDataspaceId = "sandbox";

var Humio = function Humio(options) {
  this.options = Object.assign({}, options);
  this.options.ssl = (this.options.ssl === undefined || this.options.ssl === null) || this.options.ssl;
  this.options.host = this.options.host || defaultHost;
  this.options.port = this.options.port || defaultPort;
  this.options.basePath = this.options.basePath || "";
  this.options.dataspaceId = this.options.dataspaceId || defaultDataspaceId;
  this.options.sessionId = this.options.sessionId || crypto.randomBytes(40).toString('hex');
  this.options.includeClientMetadata = this.options.includeClientMetadata || true;
  this.options.includeSessionId = this.options.includeSessionId || true;
  this.options.additionalFields = this.options.additionalFields || {};
  this.options.ingestToken = this.options.ingestToken || null;
  this.options.repository = this.options.repository || null;
};

var CLIENT_VERSION = require('./package.json').version;
var CLIENT_ID = "humio-node";

Humio.prototype.version = CLIENT_VERSION;

Humio.prototype.addMetadata = function(fields) {
  if (this.options.includeSessionId) {
    fields["@session"] = fields["@session"] || this.options.sessionId;
  }

  if (this.options.includeClientMetadata) {
    fields["@client"] = CLIENT_ID;
    fields["@clientVersion"] = CLIENT_VERSION;
  }
};

Humio.prototype.sendJson = function(json, options) {
  var defaultOptions = {
    additionalFields: {},
    tags: {},
    timestamp: null,
  };

  options = Object.assign({}, defaultOptions, options);

  var additionalFields = Object.assign({}, this.options.additionalFields, options.additionalFields);

  // Don't modify the input object directly.
  // Make a copy we can mess with.
  var sentFields = Object.assign({}, json, additionalFields);

  this.addMetadata(sentFields);

  var requestBody = [
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

  var uri = "/api/v1/ingest/humio-structured";
  return this._doIngestRequest(uri, requestBody);
};

/** Sends an unstructured message to Humio.
 * Returns a promise.
 */
Humio.prototype.sendMessage = function(message, additionalFields) {
    if (!this.options.ingestToken) {
      throw new Error("ingestToken option must be set to use sendMessage");
    }

    var fields = Object.assign({}, this.options.additionalFields, additionalFields);

    // Only strings are allowed.
    // TODO: Can we use nested attributes here?

    for (var f in fields) {
      if (typeof fields[f] !== "string") {
        fields[f] = JSON.stringify(fields[f]);
      }
    }

    this.addMetadata(fields);

    var requestBody = [
      {
        "fields": fields,
        "messages": [
          message
        ]
      }
    ];

    var uri = "/api/v1/ingest/humio-unstructured";
    return this._doIngestRequest(uri, requestBody);
};

Humio.prototype._doIngestRequest = function(uri, requestBody) {
  var requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: (this.options.basePath) + uri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.ingestToken
    }
  };

  return new Promise((resolve, reject) => {

    let makeRequest =
      this.options.ssl ? https.request : http.request;

    var request = makeRequest(requestOptions, function(res) {
      if (res.statusCode >= 400) {
        reject(new Error(`The server returned an error. statusCode=${res.statusCode} message='${res.statusMessage}'`));
      } else {
        resolve();
      }
    });

    request.on('error', reject);

    request.write(JSON.stringify(requestBody));
    request.end();
  });
}

var parseNDJSON = function(text) {
  var lines = text.split('\n');
  var last = lines.pop();
  var remainingText = "";
  var elements = [];

  if (last !== undefined) {
    elements = lines.filter(e => e !== "").map(JSON.parse);

    try {
      elements.push(JSON.parse(last));
    } catch (e) {
      // The last item is not a complete json object.
      remainingText = last;
    }
  }

  return { elements: elements, remainingText: remainingText };
};

Humio.prototype.stream = function(options, onMatch) {
  if (typeof onMatch !== 'function') throw new Error("onMatch must be a function, got " + onMatch);

  var defaultOptions = {
    queryString: "",
    start: null,
    end: "now",
    isLive: false,
  };

  options = Object.assign({}, defaultOptions, options);
  // TODO: Mention need to use API Token in docs/README

  var requestBody = options;

  var repository = options.repository || this.options.repository;

  if (!repository) {
    throw new Error("The option 'repository' must be specified.");
  }

  var requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: this.options.basePath + "/api/v1/dataspaces/" + repository + "/query",
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson'
    }
  };

  return new Promise((resolve, reject) => {
    var makeRequest = this.options.ssl ? https.request : http.request;
    var body = "";

    var request = makeRequest(requestOptions, function(res) {
      res.on("data", function(chunk) {
        body += chunk;

        // Try to see if we have one or more lines
        // report them back to the caller through onMatch.

        var parseResult = parseNDJSON(body);
        parseResult.elements.forEach(onMatch);

        // Discard any JSON that has been parsed.

        body = parseResult.remainingText;
      });
    });

    request.on('response', message => {
      var status = message.statusCode >= 400 ? "error" : "success";

      var result = {
        status: status,
        statusCode: message.statusCode,
        error: null,
        cancel: function() {
          message.destroy();
        }
      };

      if (message.statusCode >= 400) {
        result.error = body;
        reject(result);
      } else {
        resolve(result);
      }
    });

    request.on('error', reject);

    request.write(JSON.stringify(requestBody));
    request.end();
  });
};

Humio.prototype.run = function(options) {
  var self = this;

  var defaultOptions = {
    queryString: "",
    start: null,
    end: "now",
    isLive: false,
    onPartialResult: null,
  };

  options = Object.assign({}, defaultOptions, options);

  var requestBody = options;

  var repository = options.repository || this.options.repository;

  if (!repository) {
    throw new Error("The option 'repository' must be specified.");
  }

  var uri = this.options.basePath + "/api/v1/repositories/" + repository + "/queryjobs";

  var requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: uri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Accept': 'application/json',
      'Connection': 'keep-alive'
    }
  };

  return doRequest.call(this, requestOptions, requestBody)
    .then(function(res) {
      if (res.status === 'success') {
        return poll.call(self, uri, res.data.id, options.onPartialResult);
      } else {
        return res;
      }
    });
};

// Private Method
function poll(uri, jobId, onData) {
  var pollRequestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: uri + "/" + encodeURIComponent(jobId),
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken,
      'Accept': 'application/json',
      'Connection': 'keep-alive'
    }
  };

  var MAX_POLL_DELAY = 1000;

  var doPoll = (resolve, reject, timeout) => {
    doRequest.call(this, pollRequestOptions).then(function(response) {
      if (response.status === "error") {
        reject(response.error);
      } else {
        if (onData) {
          var progress = Humio.progress(response);
          onData(response, progress);
        }
        if (response.data.done) {
          resolve(response);
        } else {
          // TODO: Use the suggested poll timeout sent from the server.
          var newTimeout = Math.min(timeout + 200, MAX_POLL_DELAY);
          setTimeout(function() { doPoll(resolve, reject, newTimeout); }, newTimeout);
        }
      }
    }).catch(reject);
  };

  return new Promise(function(resolve, reject) {
    doPoll(resolve, reject);
  });
}


function doRequest(requestOptions, requestBody) {
  requestBody = requestBody || null;

  return new Promise((resolve, reject) => {
    var makeRequest = this.options.ssl ? https.request : http.request;
    var request = makeRequest(requestOptions, function(res) {

      var chunks = [];

      res.on("data", function(chunk) {
        chunks.push(chunk.toString());
      });

      res.on("end", function() {
        var status = res.statusCode >= 400 ? "error" : "success";
        var body = chunks.join("");
        var result = {
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

Humio.count = function(result, fieldName) {
  fieldName = fieldName || "_count";
  if (result.data.events) {
    return result.data.events[0]._count;
  } else {
    throw new Error("the count function only works for aggregate results");
  }
};

Humio.progress = function(result) {
  if (result.data.metaData.totalWork === 0) return 1;
  return result.data.metaData.workDone / result.data.metaData.totalWork;
};


////////////////////////////////////////////////////////////////////////////////
// Printers
////////////////////////////////////////////////////////////////////////////////


Humio.printResult = function(result, format) {
  format = format.toLowerCase();

  if (format === "groupby") {
    return printGroupBy(result);
  } else {
    throw new Error("Unknown print format. format=" + format);
  }
};

var padString = function(str, targetLength, padString) {
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

  var columns = Object.keys(result.data.events[0]);
  var getColumnWidths = function(event) {
    return columns.map(function(column) { return event[column].length; });
  };



  var keepMaxColumn = function(acc, event) {
    return getColumnWidths(event).map(function(width, i) { return  width >= acc[i] ? width : acc[i]; });
  };

  var initialWidths = columns.map(function(c) { return c.length; });
  var columnWidths = result.data.events.reduce(keepMaxColumn, initialWidths);

  var toLine = function(event) {
      return columns.reduce(function(line, column, i) {
        return line + "| " + padString(event[column], columnWidths[i]) + " ";
      }, "") + "|\n";
  };

  var header = columns.reduce(function(line, column, i) {
    return line + "| " + padString(column, columnWidths[i]) + " ";
  }, "") + "|\n";

  var seperator = '-'.repeat(header.length - 1) + '\n';
  var front = seperator + header + seperator;

  var output = result.data.events.reduce(function(out, event) {
    return out + toLine(event);
  }, front) + seperator;

  return output;
}

module.exports = Humio;
