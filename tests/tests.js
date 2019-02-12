const assert = require('assert');
const Humio = require('../index.js');

function makeClient(ingestToken) {
  return new Humio({
    host: "localhost",
    basePath: '/humio',
    ssl: false,
    port: 3000,
    apiToken: "yPTGwp4Cf2Bh0I0GE9ANVsc36WMtAw0Vy2lStwPaMMqP",
    ingestToken: ingestToken
  });
}

describe('#sendMessage()', function() {
  it('can send unstructured messages', function(done) {
    const client = makeClient("WnJEkn2Wm6pBhGSDocfAhMa04hBSeZEgjeZevu4JqBBe");

    client.sendMessage("2019-02-12T00:53:12+01:00 [INFO] User logged in. user_id=1831923 protocol=http")
      .finally(done);
  });

  it('can send structured messaged', function(done) {
    const client = makeClient("4IiuWwflssbK9wdbB84HbK5f4Fg0bNDjv3kG80U8Jplu");

    client.sendJson({ foo: "bar" }).finally(done);
  });

  it('should be able query using #stream', function(done) {
    this.timeout(30000);
    const client = makeClient();

    const args = {
      queryString: "protocol",
      start: "24hours",
      isLive: true,
      repository: "node-test",
    };

    var stop = null;
    var hasReceivedResult = false;

    const onData = (partialResult) => {
      if (!hasReceivedResult && stop !== null) {
        stop();
        done();
      }
      hasReceivedResult = true;
    };

    client.stream(args, onData)
      .then(({cancel}) => {
        if (hasReceivedResult) {
          cancel();
          done();
        } else {
          stop = cancel;
        }
      })
      .catch(done);
  });

  it('should be able to poll using #run', function(done) {
    this.timeout(30000);

    const client = makeClient();

    const args = {
      queryString: "protocol",
      start: "24hours",
      isLive: true,
      repository: "node-test",
      onPartialResult: () => done(),
    };

    client.run(args).catch(done);
  })
});
