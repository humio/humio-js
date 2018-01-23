var crypto = require("crypto");
var https = require("https");

var defaultHost = "cloud.humio.com";
var defaultPort = 443;
var defaultDataspaceId = "sandbox";

var Humio = function Humio(options) {
  if (!options.apiToken) {
    throw new Error("Humio apiToken must be specified in the options.");
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

  var requestOptions = {
    host: this.options.host,
    port: this.options.port,
    path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/ingest",
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.options.apiToken
    }
  };

  var request = https.request(requestOptions, function(res) {
    // TODO: Let sendJson take a callback where you can report error.
    if (res.statusCode >= 400) {
      console.error(res.statusCode, res.statusMessage);
    }
  });

  request.on('error', function(e) {
    // TODO: Let sendJson take a callback where you can report error.
    console.error(e);
  });

  request.write(JSON.stringify(requestBody));
  request.end();
};

Humio.prototype.sendMessage = function(parserId, message, additionalFields) {
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
        "type": parserId,
        "fields": fields,
        "messages": [
          message
        ]
      }
    ];

    var requestOptions = {
      host: this.options.host,
      port: this.options.port,
      path: "/api/v1/dataspaces/" + this.options.dataspaceId + "/ingest-messages",
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.options.apiToken
      }
    };

    var request = https.request(requestOptions, function(res) {
      // TODO: Let sendMessage take a callback where you can report error.
      if (res.statusCode >= 400) {
        console.error(res.statusCode, res.statusMessage);
      }
    });

    request.on('error', function(e) {
      // TODO: Let sendMessage take a callback where you can report error.
      console.error(e);
    });

    request.write(JSON.stringify(requestBody));
    request.end();
};

var parseNDJSON = function(text) {
  var lines = text.split('\n');
  var last = lines.pop();

  if (last) {
    var elements = lines.map(JSON.parse);
    var remainingText;
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

  var defaultOptions = {
    queryString: "",
    start: null,
    end: "now",
    isLive: false
  };

  options = Object.assign({}, defaultOptions, options);
  // TODO: Mention need to use API Token in docs/README

  var requestBody = options;

  var requestOptions = {
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

  return new Promise(function(resolve, reject) {
    var request = https.request(requestOptions, function(res) {

      var body = "";

      res.on("data", function(chunk) {
        body += chunk;
        console.log(chunk.toString());
        // Try to see if we have one or more lines
        // report them back to the caller through onMatch.

        var parseResult = parseNDJSON(body);
        parseResult.elements.forEach(onMatch);

        // Discard any JSON that has been parsed.

        body = parseResult.remainingText;
      });

      res.on("end", function(x) {
        var status = res.statusCode >= 400 ? "error" : "success";

        var result = {
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

  var requestOptions = {
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


  return doRequest(requestOptions, requestBody)
    .then(function(res) {
      if (res.status === 'success') {
        return poll.call(self, res.data.id, options.onPartialResult);
      } else {
        return res;
      }
    });
};

// Private Method
function poll(jobId, onData) {
  var pollRequestOptions = {
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

  var MAX_POLL_DEPLY = 1000;

  var doPoll = function(resolve, reject, timeout) {
    doRequest(pollRequestOptions).then(function(response) {
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
          var newTimeout = Math.min(timeout + 200, MAX_POLL_DEPLY);
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

  return new Promise(function(resolve, reject) {
    var request = https.request(requestOptions, function(res) {

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
