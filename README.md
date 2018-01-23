# Humio for NodeJS <a href="https://www.npmjs.com/package/humio"><img src="https://img.shields.io/npm/v/humio.svg" alt="" /></a>

With Humio for NodeJS you can do

- Data Mining & Ad-Hoc Searches
- Logging
- Events Collecting

## Work in Progress

This library is work in progress. You should not use it for production systems.

## Usage

Start by creating a Humio client:

```javascript
const Humio = require("humio");

const humio = new Humio({
  apiToken: "xyz...",
  host: "cloud.humio.com",
  dataspaceId: "example"
});
```

### Searching Humio

This search will count the number of new users in our system in the past 10 minutes.

```javascript
let count = null;

client.run({ queryString: '"User Created" | count()', start: "10m", isLive: true })
  .then((result) => {
    if (result.status === "success") {
      count = parseInt(result.data[0]._count);
      // Alternatively use the helper function: Humio.count(result)
    } else {
      console.error("Search Error", result.error);
    }
  }).catch(console.error);
```

You should always check `status` on `result`. Humio will not report query errors
in the catch clause, because the the operation was a success but your input was
likely not correct. The error reason is stored in `result.error`.

If the request fails do so a connection error or similar it will be reported in
`catch`.

Notice that even though `_count` is a number we have to parse it using
`parserInt`. That is because in Humio everything is just a string, and is
returned as a string.

There are two functions used for querying Humio:

- `stream`
- `run`

#### Stream

The `stream` function should be used when you have a need to stream results as they
are found by Humio. You should use `stream` for getting very large result sets –
Humio does not need to buffer then since each event is sent the instant they are found.

While it is possible use `stream()` execute aggregate functions like `timechart` or `count`,
it does not make much sense stream it those result. That is where `run` fits in.

_In a future version of Humio you might not be able to use `stream` for aggregates,
so we recommend that you don't._

#### Run

The `run` function is meant primarily for aggregate functions and small filter
searches with smaller result sets. It will start a search in Humio and periodically
return partial results as the search progresses.

E.g. the query `service=kubernetes | count()` will return the number events with
the field `service=kubernetes`. As Humio completes the search it will periodically
send back the result so far.

```javascript
client.run({query: "service=kubernetes | count()", onPartialResult: (result, progress) => {
  console.log(Humio.count(result), 100 * progress + "%");
}});
```

### Sending Events to Humio

```javascript

// Sending Structured Data (JSON)

const linux = {
  coreTemperature: "92F",
  server: "andromida-2",
  kernelVersion: "4.14.14",
  eventType: 'CORE_DUMP'
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
```

### Sending Unstructured Logs to Humio

Apart from sending json you can also send _normal_ unstructured log lines to Humio.

```javascript

// You can also send text to be parsed by a parser in Humio.
// Here we are using the build-in key-value parser (kv).

humio.sendMessage(
  "kv",
  "2018-01-19T12:58:34.441Z [warn] User login failed. username=admin ip=101.127.184.11",
  { additionalFields: {'domain': 'example.com'} }
);
```

If you are planning on using Humio for logging, consider using a log shipper
like [Filebeat](https://cloud.humio.com/docs/first-time-use/index.html) instead.
It will handle connection problems, resubmission, etc. for you and is
compatible with Humio. This goes for structured events as well.

For an serverless environment on the other hand, `humio-node` could be a great
fit for logging.

## Tips

### Additional Fields

It is also possible to add additional fields at the client level instead of
passing it to every function call.

```javascript
const humio = new Humio({ ..., additionalFields: { service: "my-service", domain: "example.com" } });
```

These fields will be added to each call to `sendJson` and `sendMessage`.

### Metadata

Humio also adds metadata to the events e.i. `@client` (always "humio-node"),
`@clientVersion` (the current version of humio-node), and `@session`.

`@session` makes it easy to track events over several messages in Humio.
Your system might have this data already and you can exclude `@session`
using:

```javascript
humio.sendJson(linux, {
  includeClientMetadata: false,
  includeSessionId: false
});
```


### TODO

- [x] Live Queries
- [ ] Buffered Sending (don't send messages one at a time)
- [x] Error handling, callback function (or Promise)
- [ ] Resubmission and back-off
- [x] Streaming Search / Partial Results
- [ ] Ability to cancel running search

## Contribute

Please Contribute if you see something missing or find a bug,
PR's are always welcome.
