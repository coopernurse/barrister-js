
// given a cookie name, returns its value, or null if the cookie is not found.
//
// taken from: https://docs.djangoproject.com/en/dev/ref/contrib/csrf/
var getCookie = function(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};

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
// clientOpts is an optional object that is passed to the Client --
// see the Client constructor for details
//
// httpOpts is an optional object with callback functions "onSuccess" and "onError" which
// (if defined) are invoked after each AJAX request and passed the same parameters as the
// error and success functions jQuery defines plus the parsed JSON-RPC response.
// This gives you a synchronous hook to intercept the raw response, inspect HTTP headers, etc.
//
var httpClient = function(o, clientOpts, httpOpts) {
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

                    if (httpOpts && httpOpts.onError) {
                        httpOpts.onError(jqXHR, textStatus, errorThrown, resp);
                    }
                    
                    callback(resp);
                },
                success: function(data, textStatus, jqXHR) {
                    var resp = parseResponse(req, null, data);

                    if (httpOpts && httpOpts.onSuccess) {
                        httpOpts.onSuccess(data, textStatus, jqXHR, resp);
                    }

                    callback(resp);
                }
            }, xsrfToken = getCookie("Xsrf-Token");

            if (xsrfToken) {
                settings.headers = {
                    "X-Xsrf-Token" : xsrfToken
                };
            }
            jQuery.ajax(o, settings);
        };
    }

    return new Client(transport, clientOpts);
};

// Export blessed functions to the Barrister namespace
Barrister.httpClient = httpClient;
Barrister.parseResponse = parseResponse;
Barrister.Client = Client;
Barrister.Contract = Contract;
Barrister.Promise = Promise;
Barrister.JSON_stringify = JSON_stringify;

}());
