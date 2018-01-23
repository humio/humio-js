var Humio = require("../index.js");

var client = new Humio({
  apiToken: process.env.HUMIO_API_KEY,
  host: process.env.HUMIO_HOST || "cloud.humio.com",
  dataspaceId: process.env.HUMIO_DATASPACE_ID || "sandbox",
});

// This search counts the number of errors
// with the word `banana` in the past 10m.

var queryOptions = {
  queryString: 'groupby(loglevel)',
  start: "100m",
  onPartialResult: onPartialResult
};

client.run(queryOptions).then(onCompletion).catch(console.error);

function onPartialResult(result, progress) {
  console.log("PROGRESS: " + (progress * 100).toFixed(2) + "%");
  console.log("");
  console.log(Humio.printResult(result, "groupby"));
  console.log("");
}

function onCompletion(result) {
  if (result.status === "error") {
    console.error("Search Error", result.error);
    return;
  }
  console.log("FINAL RESULT");
  console.log("");
  console.log(Humio.printResult(result, "groupby"));
  console.log("");
}
