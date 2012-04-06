// okResp formats id and result as a JSON-RPC result object
function okResp(id, result) {
    id = id || null;
    return { "jsonrpc": "2.0", "id": id, "result": result };
}

// The Server class holds handlers that implement the interfaces on the given IDL.
// This constructor creates a Contract for the given idl that is used to validate
// requests and responses.
function Server(idl) {
    this.handlers = { };
    this.contract = new Contract(idl);
    this.trace = null;
}

// enableTrace turns on request/response logging
//
// `logFunc` - function to call with a string. If not provided, console.log will be used.
Server.prototype.enableTrace = function(logFunc) {
    if (logFunc && (typeof logFunc === "function")) {
        this.trace = logFunc;
    }
    else {
        this.trace = function(s) { console.log(s); };
    }
};

// disableTrace turns off request/response logging
Server.prototype.disableTrace = function() {
    this.trace = null;
};

// addHandler associates the given handler object with the interface. The handler functions
// will be called when an incoming request is processed with the matching interface name.
//
// * `iface` - interface name in IDL to associate handler with
// * `handler` - object that implements all functions on the given interface
Server.prototype.addHandler = function(iface, handler) {
    this.handlers[iface] = handler;
};

// handleJSON accepts a string encoded as JSON, parses the JSON, and calls handle()
// with the parsed JSON-RPC request.
//
// * `reqJSON` - string JSON representing a JSON-RPC request
// * `callback` - function that accepts a single arg -- a string that represents the JSON
//                encoded JSON-RPC response
Server.prototype.handleJSON = function(reqJSON, callback) {
    var req;
    try {
        req = JSON.parse(reqJSON);
    }
    catch (e) {
        callback(JSON_stringify(errResp(null, -32700, "Unable to parse JSON: " + reqJSON)));
        return;
    }

    this.handle(req, function(resp) {
        callback(JSON_stringify(resp));
    });
};

// handle processes a JSON-RPC request which may be a batch or single request.
// Batch request elements will be processed concurrently.
Server.prototype.handle = function(req, callback) {
    var me = this;
    var resp, i, loggingCb, origCb;

    // log request if trace is enabled
    if (me.trace) {
        me.trace("Request: " + JSON_stringify(req));

        origCb = callback;
        loggingCb = function(r) {
            if (me.trace) {
                me.trace("Response: " + JSON_stringify(r));
            }
            origCb(r);
        };
        callback = loggingCb;
    }

    // Check if req is a batch
    if (req instanceof Array) {
        resp = [ ];

        // Create a callback for each request element that pushes the result
        // on the resp array.
        var reqCb = function(res) {
            resp.push(res);

            // If all requests have been processed, then batch is complete
            if (resp.length === req.length) {
                return callback(resp);
            }
        };

        // Check for empty batch, and start processing each request concurrently.
        if (req.length > 0) {
            for (i = 0 ; i < req.length; i++) {
                me.handleSingle(req[i], reqCb);
            }
        }
        else {
            callback(errResp(req.id, -32600, "Request contains empty batch"));
        }
    }
    else {
        // Single request case
        me.handleSingle(req, callback);
    }
};

// handleSingle processes a single JSON-RPC request (not a batch)
Server.prototype.handleSingle = function(req, callback) {
    var me = this;
    var i, msg, errObj;
    if (req.method) {

        // Special case for IDL request
        if (req.method === "barrister-idl") {
            return callback(okResp(req.id, me.contract.idl));
        }

        // JSON-RPC methods are a single string which Barrister encodes
        // as `interface.function`.  We split that apart here.
        var pos = req.method.indexOf(".");
        if (pos === -1) {
            return callback(errResp(req.id, -32601, "Method not found: " + req.method));
        }

        var ifaceName = req.method.substring(0, pos);
        var funcName  = req.method.substring(pos+1);

        var iface   = me.contract.interfaces[ifaceName];
        var func    = me.contract.functions[req.method];

        var handler = me.handlers[ifaceName];

        if (iface && func && handler && handler[funcName]) {

            // Reject request if params do not match IDL
            errObj = me.contract.validateReq(req);
            if (errObj !== null) {
                return callback(errObj);
            }

            // Create a new array to hold the params to invoke the function with
            var callParams = [];

            var paramLen = req.params ? req.params.length : 0;
            if (paramLen > 0) {
                callParams = callParams.concat(req.params);
            }

            // Always push a callback function onto the callParams array, which
            // the handler function implementation should call with the result
            // from the function.
            callParams.push(function(err, result) {
                if (err === null || err === undefined) {
                    callback(okResp(req.id, result));
                }
                else {
                    var t = typeof err;
                    var errObj;

                    // Error case. Figure out what type err is and encode
                    // as JSON-RPC error accordingly.
                    if (t === "object") {
                        if (typeof err.code === "number") {
                            errObj = errResp(req.id, err.code, err.message, err.data);
                        }
                        else {
                            errObj = errResp(req.id, -32000, "Unknown error", err);
                        }
                    }
                    else if (t === "number") {
                        errObj = errResp(req.id, parseInt(err, 10), "Server error: " + err);
                    }
                    else if (t === "string") {
                        errObj = errResp(req.id, -32000, err);
                    }
                    else {
                        console.log("Barrister passed invalid err type: " + t);
                        errObj = errResp(req.id, -32000, "Unknown error");
                    }

                    callback(errObj);
                }
            });

            // Key line: invoke the handler function with the given params
            handler[funcName].apply(handler, callParams);
        }
        else {
            return callback(errResp(req.id, -32601, "Method not found: " + req.method));
        }
    }
    else {
        return callback(errResp(req.id, -32600, "Request did not contain a method"));
    }
};
