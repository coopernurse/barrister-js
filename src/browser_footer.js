
// Constructs a new httpClient
// 
// o may be a string (URL endpoint to access) or a function
// 
// If o is a function:
//
//  * When a request is made, your function will get two args: request, callback
//  * request is an object that represents JSON-RPC request
//  * your code should call: Barrister.JSON_stringify(req) to serialize it to JSON. This stringify
//    function properly escapes non-ASCII characters to ensure uniform behavior across servers.
//  * Make a POST request to the endpoint as desired, make sure to set Content-Type to
//    "application/json"
//  * Invoke the callback with a JSON-RPC response.  Use the `Barrister.parseResponse` helper
//    function to simplify this.  Pass it the original req you were given, 
//    an error string (if the request failed, or null if succeeded), and the raw response body.
//
// opts is an optional object that is passed to the Client -- 
// see the Client constructor for details
//
var httpClient = function(o, opts) {
    var transport = o;

    // Assume that o is an URL endpoint
    if (typeof o === "string") {
        transport = function(req, callback) {
            var settings = {
                type: "POST",
                contentType: "application/json",
                data: JSON_stringify(req),
                converters: { 
                    "text json" : function(data) {
                        // Parse JSON ourselves to ensure that parse errors
                        // are trapped and correct error code returned
                        return parseResponse(req, null, data);
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    var resp;
                    if (jqXHR && jqXHR.status === 0) {
                        resp = errResp(req.id, -32002, "HTTP request aborted", jqXHR);
                    }
                    else {
                        resp = parseResponse(req, textStatus+" "+errorThrown, null);
                    }
                    callback(resp);
                },
                success: function(data, textStatus, jqXHR) {
                    callback(parseResponse(req, null, data));
                }
            };
            jQuery.ajax(o, settings);
        };
    }

    return new Client(transport, opts);
};

// Export blessed functions to the Barrister namespace
Barrister.httpClient = httpClient;
Barrister.parseResponse = parseResponse;
Barrister.Client = Client;
Barrister.Contract = Contract;
Barrister.JSON_stringify = JSON_stringify;

}());
