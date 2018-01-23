var Humio = require("../index.js");

var client = new Humio({
  apiToken: process.env.HUMIO_API_TOKEN,
  host: "cloud.humio.com",
  dataspaceId: "humio",
});

// This search counts the number of errors
// with the word `banana` in the past 10m.

const queryOptions = {
  queryString: 'loglevel = /error/i | banana | count()',
  start: "10m",
  onPartialResult: onPartialResult
};

client.run(queryOptions).then(onCompletion).catch(console.error);

function onPartialResult(result, progress) {
  const percent = "(" + (progress * 100).toFixed(2) + "%)";
  console.log("Partial Result: " + Humio.count(result) + " " + percent);
}

function onCompletion(result) {
  if (result.status === "success") {
    // We use the `count` helper to extract the _count field from the
    // first record in the dataset.
    console.info("Final Count:", Humio.count(result));
  } else {
    console.error("Search Error", result.error);
  }
}
