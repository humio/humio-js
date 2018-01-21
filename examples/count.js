var Humio = require("../index.js");

var client = new Humio({
  apiToken: process.env.HUMIO_API_TOKEN,
  host: "cloud.humio.com",
  dataspaceId: "sandbox"
});


// Run a search for events containing the string "User Created".
// How many uses have signed up in the past 10m.

client.run({ queryString: '"User Created" | count()', start: "10m" })
  .then((result) => {
    if (result.status === "success") {
      console.info("Event Count:", result.data[0]._count);
    } else {
      console.error("Search Error", result.error);
    }
  }).catch(console.error);
