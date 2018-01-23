var Humio = require("../index.js");

var client = new Humio({
  apiToken: process.env.HUMIO_API_TOKEN,
  host: process.env.HUMIO_HOST || "cloud.humio.com",
  dataspaceId: process.env.HUMIO_DATASPACE_ID || "sandbox"
});

// Stream all event that contains the field `loglevel` that matches
// the regular expression /error/i.

// This is a good example of where to use the `stream` function instead
// of `run`. There are potentially a huge amount of events that match
// this query, and we want to make a copy of everything, but don't want
// to keep it in memory.

var queryOptions = {
  queryString: '',
  start: "1m"
};

client.stream(queryOptions, onMatch)
  .then(onCompletion)
  .catch(console.error);

function onMatch(json) {
  // Usually you will want to write the event to some buffer,
  // for later batch processing, e.g. writing to disk.
  console.log(json);
}

function onCompletion(result) {
  if (result.status === "success") {
    // Unlike in `run` we do not have access to the data set in the completion
    // handler. You must cache or buffer it in onMatch.
    console.info("Done");
  } else {
    console.error("Search Error", result.error);
  }
}
