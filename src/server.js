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
    this.filters  = null;
    this.contract = new Contract(idl);
    this.trace = null;
}

// Sets the filters for this Server.  Allows a single object, or an array.
// Pass in null to clear existing filters.
// 
// Filter objects should contain `pre` and/or `post` callback functions that
// accept a context and callback.  context is an object that contains:
//
// * `props` - object of properties that were passed to Server.handle() or handleJSON()
// * `request` - JSON-RPC request 
// * `response` - The JSON-RPC response as an object (post hooks only) 
// 
// Example:
// 
//     var filter = {
//         pre: function(context, callback) {
//             var method = context.request.method;
//             if (method === "FooService.deleteUser") {
//                 if (!context.props.adminUser) {
//                     context.error = { code: 300, message: "Permission denied" };
//                 }
//             }
//             callback();
//         }
//     };
//     server.setFilters(filter);
Server.prototype.setFilters = function(filters) {
    var arr = null;
    if (filters !== null && filters !== undefined) {
        arr = [ ];

        var t = typeof filters;
        
        if (filters instanceof Array) {
            arr = arr.concat(filters);
        }
        else if (t === "object") {
            arr.push(filters);
        }
        else {
            throw "filters must be an object or array";
        }
    }

    this.filters = arr;
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
// * `props` - object of request meta-properties. will be passed to filters.
// * `reqJSON` - string JSON representing a JSON-RPC request
// * `callback` - function that accepts a single arg -- a string that represents the JSON
//                encoded JSON-RPC response
Server.prototype.handleJSON = function(props, reqJSON, callback) {
    var req;
    try {
        req = JSON.parse(reqJSON);
    }
    catch (e) {
        callback(JSON_stringify(errResp(null, -32700, "Unable to parse JSON: " + reqJSON)));
        return;
    }

    this.handle(props, req, function(resp) {
        callback(JSON_stringify(resp));
    });
};

// handle processes a JSON-RPC request which may be a batch or single request.
// Batch request elements will be processed concurrently.
// 
// Same parameters as handleJSON, except req is an object (not string)
//
Server.prototype.handle = function(props, req, callback) {
    var me = this;
    var resp, i;

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
                me.handleSingle(props, req[i], reqCb);
            }
        }
        else {
            callback(errResp(req.id, -32600, "Request contains empty batch"));
        }
    }
    else {
        // Single request case
        me.handleSingle(props, req, callback);
    }
};

// handleSingle processes a single JSON-RPC request (not a batch)
Server.prototype.handleSingle = function(props, req, callback) {
    var me = this;
    var key;
    var context = { 
        props: props,
        request: req
    };

    me._runFilters("pre", context, function() {
        // If a filter sets context.error with a numeric error code, then
        // skip request execution and return the error
        if (context.error && typeof context.error.code === "number") {
            callback(errResp(req.id, parseInt(context.error.code, 10), 
                             context.error.message, context.error.data));
        }
        else {
            // Execute the handler for this request
            me._execute(req, function(resp) {
                context.response = resp;
                
                me._runFilters("post", context, function() {

                    // Validate the resp object and hit callback
                    callback(me.contract.validateResp(req, resp));
                });

            });
        }
    });
};

// Executes all filters set on the Server
//
// * `hook` - string of the function name to run (e.g. pre or post)
// * `context` - object containing params, request, and (if hook=='post') response
// * `callback` - callback to call when all filters have executed
//
// If a filter does not define a function for the hook then it will be silently
// skipped.
Server.prototype._runFilters = function(hook, context, callback) {
    var me = this;
    var nextFilter, filter;

    if (me.filters && me.filters.length > 0) {
        filters = [];
        filters = filters.concat(me.filters);

        nextFilter = function() {
            if (filters.length > 0) {
                filter = filters.shift();
                if (filter[hook]) {
                    filter[hook](context, function() {
                        nextFilter();
                    });
                }
                else {
                    nextFilter();
                }
            }
            else {
                callback();
            }
        };

        nextFilter();
    }
    else {
        callback();
    }
};

Server.prototype._execute = function(req, callback) {
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
