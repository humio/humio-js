# Humio Javascript Client <a href="https://www.npmjs.com/package/humio"><img src="https://img.shields.io/npm/v/humio.svg" alt="" /></a>

With Humio's Javascript client you can do Execute Queries and Searches and Log to Humio.

## Usage

```
npm install -S humio
```

Depending on your environment you should use the import the appropriate file:


### NodeJs, Webpack or similar

```javascript
import Humio from 'humio';
// or
var Humio = require('humio')
```

### Vanilla Browser

```html
<script src="<path-to-humio>/dist/humio.browser.js"></script>
<script>
    window.Humio
</script>
```

### Creating a client instance

```javascript
const humio = new Humio({
  apiToken: "xyz...", // needed if you use the administration api
  ingestToken: "xyz...", // the default ingest tokens to use for #run and #stream
  host: "cloud.humio.com", // the host name
  port: 443, // default (443), the port Humio is run on
  basePath: "/", // default ("/"), basePath prepended to all API URLs.
  repository: "sandbox" // default ("sandbox"), the default repository (or view) to work with
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
in the catch clause, because the operation was a success, but your input was
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

You will need to assign a parser to the ingest token in Humio before using the
unstructured ingest API.

```javascript

humio.sendMessage(
  "2018-01-19T12:58:34.441Z [warn] User login failed. username=admin ip=101.127.184.11",
  {'domain': 'example.com'}
);
```

If you are planning on using Humio for logging, consider using a log shipper
like [Filebeat](https://docs.humio.com/integrations/data-shippers/beats/filebeat/) instead.
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
- [ ] Ability to cancel running search (works for #stream, not #run)

## Contribute

Please Contribute if you see something missing or find a bug,
PR's are always welcome.
