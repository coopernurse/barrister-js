
var httpClient = function(o) {
    var transport = o;
    if (typeof o === "string") {
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
Barrister.Client = Client;
Barrister.Contract = Contract;
Barrister.JSON_stringify = JSON_stringify;

}());
