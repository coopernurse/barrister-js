
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

// Export blessed functions to the package
exports.httpClient = httpClient;
exports.Client = Client;
exports.Server = Server;
exports.JSON_stringify = JSON_stringify;
