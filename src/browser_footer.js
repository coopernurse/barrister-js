
// Constructs a new httpClient
// 
// o may be a string (URL endpoint to access) or a function
// 
// If o is a function:
//  * When a request is made, your function will get two args: request, callback
//  * request is an object that represents JSON-RPC request
//  * your code should call: Barrister.JSON_stringify(req) to serialize it to JSON. This stringify
//    function properly escapes non-ASCII characters to ensure uniform behavior across servers.
//  * Make a POST request to the endpoint as desired, make sure to set Content-Type to
//    "application/json"
//  * Invoke the callback with a JSON-RPC response.  Use the `Barrister.parseHttpResponse` helper
//    function to simplify this.  Pass it the original req you were given, 
//    an error string (if the request failed, or null if succeeded), and the raw response body.
//
var httpClient = function(o) {
    var transport = o;
    if (typeof o === "string") {
        // o is 
        transport = function(req, callback) {
            var settings = {
                type: "POST",
                contentType: "application/json",
                data: JSON_stringify(req),
                error: function(jqXHR, textStatus, errorThrown) {
                    callback(parseHttpResponse(req, textStatus+" " +errorThrown, null));
                },
                success: function(data, textStatus, jqXHR) {
                    callback(parseHttpResponse(req, null, data));
                }
            };
            jQuery.ajax(o, settings);
        };
    }

    return new Client(transport);
};

Barrister.httpClient = httpClient;
Barrister.parseHttpResponse = parseHttpResponse;
Barrister.Client = Client;
Barrister.Contract = Contract;
Barrister.JSON_stringify = JSON_stringify;

}());
