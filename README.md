# Humio for NodeJS

A NodeJS library for sending event data to Humio.

If you are planning on using Humio for logging, consider using a log shipper
like [Filebeat](https://cloud.humio.com/docs/first-time-use/index.html) instead.
It will handle connection problems, resubmission, etc. for you and is
compatible with Humio.

For an serverless environment on the other hand, `humio-node` could be a great
fit for logging.

## Work in Progress

This library is work in progress. You should not use it for production systems.

## Usage

```javascript
const Humio = require("../index.js"); // require("humio")

const humio = new Humio({
  apiToken: process.env.HUMIO_API_TOKEN,
  host: process.env.HUMIO_HOST || "cloud.humio.com",
  dataspaceId: "example"
});

// Sending Structured Data (JSON)

const linux = {
  coreTemperature: "92F",
  server: "andromida-2",
  kernelVersion: "4.14.14"
};

humio.sendJson(linux);

// You can specify additional fields to be added to the data,
// without having to modify `linux`.

humio.sendJson(linux, { additionalFields: { "example": "more-fields" } });

// By default Humio uses the current time as the event's timestamp.
// You can override it, if the event did not happen right now.

humio.sendJson(linux, {
  timestamp: "2018-01-19T12:58:34.441Z",
  additionalFields: { "example": "custom-timestamp" }
});

// Humio adds metadata to the events e.i. @client (always "humio-node"),
// @clientVersion (the current version of humio-node), and @session.
//
// @session makes it easy to track events over several messages in Humio.
// Your system might have this data already and you can exclude @session
// using

humio.sendJson(linux, {
  includeClientMetadata: false,
  includeSessionId: false,
  additionalFields: { "example": "no-metadata" }
});


// You can also send text to be parsed by a parser in Humio.
// Here we are using the build-in key-value parser (kv).

humio.sendMessage(
  "kv",
  "2018-01-19T12:58:34.441Z [warn] User login failed. username=admin ip=101.127.184.11",
  { additionalFields: {'domain': 'example.com'} }
);
```

### Checklist

- [ ] Feature: Search Humio
- [ ] Buffered Sending (don't send messages one at a time)
- [ ] Error handling, callback function (or Promise)
- [ ] Resubmission and back-off
- [ ] Feature: Search Streaming

## Contribute

Please Contribute if you see something missing or find a bug,
PR's are always welcome.
