
var httpClient = function(endpoint) {
    var httpTransport = function(req, callback) {
        var reqJson = JSON_stringify(req, true);
        var options = {
            url: endpoint,
            method: "POST",
            headers: {
                contentType: "application/json"
            },
            body: reqJson
        };
        request(options, function(error, response, body) {
            callback(parseHttpResponse(req, error, body));
        });
    };

    return new Client(httpTransport);
};

exports.httpClient = httpClient;
exports.Client = Client;
exports.Server = Server;
exports.JSON_stringify = JSON_stringify;
