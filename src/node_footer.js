
// httpClient returns a Client instance for the given URL endpoint
var httpClient = function(endpoint) {
    var httpTransport = function(req, callback) {
        var reqJson = JSON_stringify(req);
        var options = {
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: reqJson
        };
        request(options, function(error, response, body) {
            callback(parseResponse(req, error, body));
        });
    };

    return new Client(httpTransport);
};

// inprocClient returns a Client instance that calls the given Server
// directly in process.  This is useful in cases where you develop
// separate barrister components as separate packages, but wind up 
// combining them into a single program at runtime.  It is also useful
// for unit testing barrister server implementations because your
// tests can consume the service as a Barrister client, which will 
// perform all the type checks on requests/response values.  This will
// catch many problems automatically that you'd normally have to write
// assertions for (e.g. function returned an int, but you expected a bool)
var inprocClient = function(server) {
    var transport = function(req, callback) {
        server.handle({}, req, callback);
    };

    return new Client(transport);
};

// Export blessed functions to the package
exports.httpClient = httpClient;
exports.inprocClient = inprocClient;
exports.Client = Client;
exports.Server = Server;
exports.JSON_stringify = JSON_stringify;
