// Function to create IDs for requests
var rchars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function randstr(len) {
    var s = "";
    var i;
    for (i = 0; i < len; i++) {
        var rnum = Math.floor(Math.random() * rchars.length);
		s += rchars.substring(rnum,rnum+1);
    }
    return s;
}


var jsonRegex = new RegExp('[\\u007f-\\uffff]', 'g');
var jsonRegexReplace = function(c) {
    return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
};

// JSON_stringify takes a JSON string and escapes unicode characters
//
// Built in JSON.stringify() will return unicode characters that require
// UTF-8 encoding on the wire.  Barrister specifies that all JSON strings be
// ASCII safe (to minimize surprises).  This function will replace unicode
// characters with their escaped (ASCII-safe) equivalents.
//
// If emit_unicode is true then s is returned unchanged
//
function JSON_stringify(s, emit_unicode) {
    if (s) {
        var json = JSON.stringify(s);
        if (json) {
            return emit_unicode ? json : json.replace(jsonRegex, jsonRegexReplace);
        }
        else {
            return json;
        }
    }
    else {
        return s;
    }
}

// makeRequest returns a JSON-RPC 2.0 compliant request object, setting 'id', 'method', and 'params'.
// A random request ID is generated for the request, which is used to correlate
// requests and responses for batch mode.
function makeRequest(method, params) {
    var req = { "jsonrpc": "2.0", "id": randstr(20), "method": method };

    // JSON-RPC allows params to be omitted if the method takes no params
    if (params !== null && params !== undefined) {
        req.params = params;
    }
    return req;
}

// errResp creates a JSON-RPC 2.0 compliant response object for an error.
//
// * `id` - id of the request. May be null in the case of a malformed request.
// * `code` - integer error code
// * `msg` - string that describes the error
// * `data` - optional. additional information about the error. type is application specific.
function errResp(id, code, msg, data) {
    id = id || null;
    return { "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": msg, "data": data } };
}

// parseResponse creates a JSON-RPC response object from the raw response body
//
// * `req` - JSON-RPC request object this response correlates with
// * `error` - string describing a transport related error. should be null if no transport
//             errors occurred. If non null, a JSON-RPC error response will be returned.
// * `body` - Raw response body from the server. Currently should be JSON encoded, but 
//            additional serialization formats may be supported in the future.
//
function parseResponse(req, error, body) {
    var resp;
    if (error) {
        resp = errResp(req.id, -32000, error);
    }
    else if (body !== undefined && body !== null) {
        // Some clients (like jQuery) want to parse the body eagerly.
        // Assume that if we have an object, we've already been parsed.
        if (typeof body === "object") {
            resp = body;
        }
        else {
            try {
                resp = JSON.parse(body);
            }
            catch (e) {
                resp = errResp(req.id, -32700, "Unable to parse response JSON: " + body);
            }
        }
    }
    else {
        resp = errResp(req.id, -32603, "Null response body received from server");
    }
    return resp;
}

// The Contract class represents a single parsed IDL.  Contracts contain interfaces,
// structs, and enums.  It also encapsulates the type validation rules.
//
// `idl` - Barrister parsed IDL (array of objects)
function Contract(idl) {
    var i, x, e, f;
    this.idl = idl;
    this.interfaces = { };
    this.functions  = { };
    this.structs    = { };
    this.enums      = { };

    // Separate the IDL into interfaces/structs/enums
    for (i = 0; i < idl.length; i++) {
        e = idl[i];
        if (e.type === "interface") {
            this.interfaces[e.name] = e;
            for (x = 0; x < e.functions.length; x++) {
                f = e.functions[x];
                this.functions[e.name+"."+f.name] = f;
            }
        }
        else if (e.type === "struct") {
            this.structs[e.name] = e;
        }
        else if (e.type === "enum") {
            this.enums[e.name] = e;
        }
    }
}

// validate takes an expected type and value and returns a two element array
// that indicates whether the value matches the expected type.
//
// `return[0]` - boolean - true if validation passed, false if it failed
// `return[1]` - string that describes the validation failure. null if validation passed.
//
// Params:
//
// * `namePrefix` - string to prefix to return[1] on failure
// * `expected` - object that holds the expected type information
// * `isArray` - boolean that indicates whether val should be an array
// * `val` - value to validate
Contract.prototype.validate = function(namePrefix, expected, isArray, val) {
    var me = this;
    var i, e, fields, fieldKeys, valid, isInt;

    // Returned when validation passes
    var okRes = [ true, null ];

    namePrefix = namePrefix || "";

    if (val === null || val === undefined) {
        // if type was annotated as [optional], then null vals are OK
        if (expected.optional === true) {
            return okRes;
        }
        else {
            return [false, namePrefix + " cannot be null"];
        }
    }
    else {
        var t = typeof val;
        if (isArray === true) {
            // IDL expects an array. Reject val if it's not a JS Array
            if (t !== "object" || !val instanceof Array) {
                return me.validationErr(namePrefix, "[]"+expected.type, t, val);
            }

            // Recursively validate all array members
            for (i = 0; i < val.length; i++) {
                valid = me.validate(namePrefix + "["+i+"]", expected, false, val[i]);
                if (!valid[0]) {
                    return valid;
                }
            }

            return okRes;
        }
        else if (expected.type === "string") {
            return t === "string" ? okRes : me.validationErr(namePrefix, expected.type, t, val);
        }
        else if (expected.type === "bool") {
            return t === "boolean" ? okRes : me.validationErr(namePrefix, expected.type, t, val);
        }
        else if (expected.type === "int" || expected.type === "float") {
            if (t !== "number") {
                return me.validationErr(namePrefix, expected.type, t, val);
            }

            // This is our way of distinguishing floats from integers in JS
            // See: http://bit.ly/zBGvzR
            if (expected.type === "int") {
                isInt = val===+val && val===(val|0);
                if (!isInt) {
                    return me.validationErr(namePrefix, expected.type, "float", val);
                }
            }

            return okRes;
        }
        else if (me.structs[expected.type]) {
            // we expect a user defined struct. val must be a JS object
            if (t !== "object") {
                return me.validationErr(namePrefix, expected.type, t, val);
            }

            // get all fields for this struct, including fields on ancestors
            fields = me.getAllStructFields([], me.structs[expected.type]);
            fieldKeys = { };
            for (i = 0; i < fields.length; i++) {
                e = fields[i];

                // recursively validate the field. return on any failure.
                valid = me.validate(namePrefix+"."+e.name, e, e.is_array, val[e.name]);
                if (!valid[0]) {
                    return valid;
                }

                // keep track of fields on the struct
                fieldKeys[e.name] = 1;
            }

            // iterate through all keys in val and validate that they exist
            // on the struct
            for (i in val) {
                if (val.hasOwnProperty(i) && !fieldKeys[i]) {
                    return [ false, namePrefix+"."+e.name+" does not exist in type '" + 
                             expected.type + "'" ];
                }
            }

            return okRes;
        }
        else if (me.enums[expected.type]) {
            // enum values should always be JS strings
            if (t !== "string") {
                return me.validationErr(namePrefix, expected.type, t, val);
            }

            // validate that val is in the enum.values list from the IDL.
            // could be optimized into a map down the road.
            e = me.enums[expected.type];
            for (i = 0; i < e.values.length; i++) {
                if (e.values[i].value === val) {
                    return okRes;
                }
            }

            // didn't find it
            var msg = namePrefix + " value '" + val + "' is not in the enum '" + 
                e.name + "': " + JSON.stringify(e.values);
            return [ false, msg ];
        }
        else {
            // this is an unlikely branch and suggests the IDL is invalid
            return [ false, namePrefix + " unknown type: " + expected.type ];
        }
    }
};

// validateReq accepts a JSON-RPC request object and checks the req.params array to 
// ensure the length and types match the IDL for the function referenced in req.method
//
// Returns null if the request validates.  Returns a JSON-RPC response object with the
// error property set if the request does not validate.
Contract.prototype.validateReq = function(req) {
    // special case for IDL request - never validate, as params are ignored by server
    if (req.method === "barrister-idl") {
        return null;
    }

    // verify req.method exists on IDL
    var func = this.functions[req.method];
    if (!func) {
        return errResp(req.id, -32601, "Method not found: " + req.method);
    }

    var paramLen = req.params ? req.params.length : 0;
    var i, valid, msg;

    // verify req.params match the expected length for the IDL function
    if (paramLen !== func.params.length) {
        msg = "Param length: " + paramLen + " != expected length: " + func.params.length;
        return errResp(req.id, -32602, msg);
    }
    
    // verify each req.params type matches the function param's expected type
    for (i = 0; i < func.params.length; i++) {
        valid = this.validate(func.params[i].name, 
                              func.params[i], 
                              func.params[i].is_array,
                              req.params[i]);
        if (!valid[0]) {
            msg = "Invalid request param["+i+"]: " + valid[1];
            return errResp(req.id, -32602, msg);
        }
    }

    // valid
    return null;
};

Contract.prototype.validateResp = function(req, resp) {
    // ignore error responses and IDL requests
    if (!resp.result || req.method === "barrister-idl") {
        return resp;
    }

    // verify req.method exists on IDL
    var func = this.functions[req.method];
    if (!func) {
        return errResp(req.id, -32601, "Method not found: " + req.method);
    }

    var valid = this.validate("", func.returns, func.returns.is_array, resp.result);
    if (!valid[0]) {
        var msg = "Invalid response for " + req.method + ": " + valid[1];
        console.log("ERROR: " + msg);
        return errResp(req.id, -32001, msg);
    }
    else {
        return resp;
    }
};

// getAllStructFields returns an array of fields for the given struct and its
// ancestors. It's recursive.
//
// Params:
// 
// * `fields` - array of fields to concat struct.fields onto
// * `struct` - struct to concat. if struct['extends'] exists, then we recurse
Contract.prototype.getAllStructFields = function(fields, struct) {
    if (struct.fields.length > 0) {
        fields = fields.concat(struct.fields);
    }

    if (struct['extends']) {
        return this.getAllStructFields(fields, this.structs[struct['extends']]);
    }
    else {
        return fields;
    }
};

// validationErr returns a two element array indicating a type validation error.
// 
// Used by validate() function
Contract.prototype.validationErr = function(namePrefix, expType, actType, val) {
    return [ false, namePrefix + " expects type '" + expType + "' but got type '" + 
             actType + "' for value: " + val ];
};

// The Batch class is used to batch multiple requests against a server in a single
// roundtrip.
//
// * `client` - a Client instance to associate with the batch.
function Batch(client) {
    this.client  = client;
    this.reqList = [];
}

// proxy returns an object for the given interface that can be used to make RPC 
// calls for that interface
Batch.prototype.proxy = function(ifaceName) {
    var me = this;
    return me.client._proxy(function(method) { return me._functionProxy(method); }, ifaceName);
};

// Used by the proxy objects - overrides the Client.request behavior.
// Instead of making a call to the server, we simply push the request on an array.
Batch.prototype.request = function(method, params) {
    this.reqList.push(makeRequest(method, params));
};

// Internal function to dispense a function for calling the given method
Batch.prototype._functionProxy = function(method) {
    var client = this;
    return function() {
        // unlike Client._functionProxy, don't pop the last arg
        // since batch invocations don't supply callbacks
        var args = Array.prototype.slice.call(arguments);
        client.request(method, args);
    };
};

// Sends the batch to the server
//
// The callback will be passed two parameters:
//
// * `err`     - Single RPC error - typically only set if a transport error occurs
// * `results` - Array of all results in the batch in the same order that the requests were
//               queued on the batch.  Results may contain RPC errors as well as successes
//
// results is array of JSON-RPC result objects.  test for these keys:
//
// *  `error` - If set, this result is an error.  Value if an object with 'code', 'message', 
//              and 'data' (optional) keys.
// *  `result` - If set, this result is a success. Value is the return value from the RPC call.
//
Batch.prototype.send = function(callback) {
    var me = this;
    var i, r, errObj;

    // map of request ids to response objects
    var idToResp = { };

    // requests to send to server
    var reqList = [];

    // iterate through requests queued on this batch, validate them,
    // and copy them to the errors list or reqList
    for (i = 0; i < me.reqList.length; i++) {
        r = me.reqList[i];
        if (me.client.validateRequest) {
            errObj = me.client.contract.validateReq(r);
            if (errObj) {
                idToResp[r.id] = errObj;
            }
            else {
                reqList.push(r);
            }
        }
        else {
            reqList.push(r);
        }
    }

    var genResponseArr = function(reqList, idToResp) {
        var respList = [ ];
        var respObj;
        for (i = 0; i < reqList.length; i++) {
            if (reqList[i].id) {
                r = idToResp[reqList[i].id];
                if (r) {
                    r = me.wrapResp(reqList[i], r);
                    if (r.error) {
                        respObj = { error: r.error };
                    }
                    else {
                        respObj = { result: r.result };
                    }
                }
                else {
                    msg = "No response received for request id: " + reqList[i].id;
                    respObj = { error: me.wrapResp(reqList[i], errResp(-32603, msg)) };
                }

                respList.push(me.wrapResp(reqList[i], respObj));
            }
        }
        return respList;
    };

    // We have no valid requests, so hit the callback immediately.
    // This could occur if the batch were empty, or if all requests in
    // the batch failed type validation
    if (reqList.length === 0) {
        callback(null, genResponseArr(me.reqList, idToResp));
        return;
    }

    // Send the valid requests to the server
    me.client._send(reqList, function(resp) {
        if (resp !== null && resp !== undefined && resp instanceof Array) {
            // reorder results to match the order of the requests,
            // as server may return them in a different order
            var results = [ ];

            var i, r, msg;
            for (i = 0; i < resp.length; i++) {
                r = resp[i];
                if (r.id) {
                    idToResp[r.id] = r;
                }
            }

            // iterate through reqList and find the response matching each request id.
            // push onto the errors list or results list depending on whether the 
            // response was successful or not.
            callback(null, genResponseArr(me.reqList, idToResp));
        }
        else {
            // single error - probably a transport related issue
            // we can't correlate this to any single request, so pass
            // an empty req object to wrapResp
            callback(resp, null);
        }
    });
};

// Adds the request id and params to the response so that the batch send() callback
Batch.prototype.wrapResp = function(req, resp) {
    resp.method = req.method;
    resp.params = req.params;
    return resp;
};

// The Client class is responsible for making requests to the server using
// the given transport function.
//
// `transport` is a function that accepts a request object and callback function
function Client(transport) {
    this.transport = transport;
    this.trace = null;

    // You may set this to false to disable client side request validation
    this.validateRequest = true;
}

// laodContract requests the IDL from the server and sets a Contract object
// on the client if the request succeeds.
//
// `callback` - function that accepts an error.  Will be called when request
//              completes.  If successful, error will be undefined.  Otherwise
//              it will contain a JSON-RPC response with an error slot.
Client.prototype.loadContract = function(callback) {
    var me = this;
    me.request("barrister-idl", [], function(err, result) {
        if (err) {
            callback(err);
        }
        else {
            me.contract = new Contract(result);
            callback();
        }
    });
};

// enableTrace turns on request/response logging
//
// `logFunc` - function to call with a string. If not provided, console.log will be used.
Client.prototype.enableTrace = function(logFunc) {
    if (logFunc && (typeof logFunc === "function")) {
        this.trace = logFunc;
    }
    else {
        this.trace = function(s) { console.log(s); };
    }
};

// disableTrace turns off request/response logging
Client.prototype.disableTrace = function() {
    this.trace = null;
};

// startBatch returns a new Batch object associated with this Client
Client.prototype.startBatch = function() {
    return new Batch(this);
};

// proxy returns a new proxy object for the given interface.
//
// If loadContract() has not successfully completed, or no interface exists 
// with the given name, an exception will be thrown.
Client.prototype.proxy = function(ifaceName) {
    var me = this;
    return me._proxy(function(method) { return me._functionProxy(method); }, ifaceName);
};

// Internal function for creating a proxy that is shared by Client and Batch.
//
// * `funcProxyCreator` - function that returns a proxy function for a given method. Client
//                        and Batch provide separate functions so that the proxy behavior can differ
// * `ifaceName` - name of interface on IDL to return proxy object for
Client.prototype._proxy = function(funcProxyCreator, ifaceName) {
    var me = this;

    if (!me.contract) {
        throw "Contract.loadContract() has not been called yet!";
    }

    var iface = me.contract.interfaces[ifaceName];
    if (iface) {
        var proxy = { };
        var i, func;
        for (i = 0; i < iface.functions.length; i++) {
            func = iface.functions[i];
            proxy[func.name] = funcProxyCreator(ifaceName+"."+func.name);
        }
        return proxy;
    }
    else {
        throw "Interface not found: " + ifaceName;
    }
};

// Creates a function proxy for Client, which will make a request to the
// server when called.
Client.prototype._functionProxy = function(method) {
    var client = this;
    return function() {
        // last arg is always the callback. pop it off the
        // args copy so that it's not passed as a RPC parameter
        var args = Array.prototype.slice.call(arguments);
        var callback = args.pop();

        // sanity check
        if (callback === undefined || callback === null || typeof callback !== "function") {
            throw "Last arg to " + method + " must be a callback function!";
        }

        client.request(method, args, callback);
    };
};

// request makes a single request to the server
Client.prototype.request = function(method, params, callback) {
    var me  = this;

    // turn method/params into a JSON-RPC request object
    var req = makeRequest(method, params);

    // optionally validate request
    if (me.validateRequest && me.contract) {
        var err = me.contract.validateReq(req);
        if (err) {
            callback(err.error, null);
            return;
        }
    }

    // send request to server
    me._send(req, function(resp) {
        // check for JSON-RPC error
        if (resp.error) {
            callback(resp.error, null);
        }
        else {
            // Successful response, pass result to callback
            callback(null, resp.result);
        }
    });
};

// _send makes the request to the server 
Client.prototype._send = function(req, callback) {
    var me = this;

    // log request if trace is enabled
    if (me.trace) {
        me.trace("Request: " + JSON_stringify(req));
    }

    // make request using transport provided to Client constructor
    me.transport(req, function(resp) {
        // log response if trace is enabled
        if (me.trace) {
            me.trace("Response: " + JSON_stringify(resp));
        }

        callback(resp);
    });
};
