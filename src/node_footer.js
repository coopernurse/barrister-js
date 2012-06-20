
// httpClient returns a Client instance for the given URL endpoint
//
// opts is an optional object that is passed to the Client -- 
// see the Client constructor for details
//
var httpClient = function(endpoint, opts) {
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

    return new Client(httpTransport, opts);
};

// Export blessed functions to the package
exports.httpClient = httpClient;
exports.inprocClient = inprocClient;
exports.Client = Client;
exports.Server = Server;
exports.JSON_stringify = JSON_stringify;
