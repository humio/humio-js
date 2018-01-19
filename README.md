# Humio for NodeJS

Send data and logs to Humio from NodeJS.

## Work in Progress

This library is work in progress. You should not use it for production systems.

## Usage

```
var humio = new Humio("{{Ingest Token Here}}");

// Sending Json

humio.sendJson({ "error": "Unauthorized", "login": "admin" });

// Sending Arbitrary Text and Custom Fields

humio.send("accesslog", "124.102.122.61 - ...", { "temperature": "12F", "weekday": "monday" });
```

### Checklist

- [ ] Buffered Sending (don't send messages one at a time)
- [ ] Error handling
- [ ] Resubmission and back-off

## Contribute

Please Contribute if you see something missing or find a bug,
PR's are always welcome.
