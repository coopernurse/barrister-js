var rchars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz";
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

function makeRequest(method, params) {
    var req = { "jsonrpc": "2.0", "id": randstr(20), "method": method };
    if (params !== null && params !== undefined) {
        req.params = params;
    }
    return req;
}

function errResp(id, code, msg, data) {
    id = id || null;
    return { "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": msg, "data": data } };
}

function parseHttpResponse(req, error, body) {
    var resp;
    if (error) {
        resp = errResp(req.id, -32000, error);
    }
    else if (body !== undefined && body !== null) {
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

function Contract(idl) {
    var i, x, e, f;
    this.idl = idl;
    this.interfaces = { };
    this.functions  = { };
    this.structs    = { };
    this.enums      = { };

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

Contract.prototype.validate = function(namePrefix, expected, isArray, val) {
    var me = this;
    var i, e, fields, fieldKeys, valid;
    var okRes = [ true, null ];

    namePrefix = namePrefix || "";

    if (val === null || val === undefined) {
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
            if (t !== "object" || !val instanceof Array) {
                return me.validationErr(namePrefix, "[]"+expected.type, t, val);
            }

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

            if (expected.type === "int" && val !== Math.round(val)) {
                return me.validationErr(namePrefix, expected.type, "float", val);
            }

            return okRes;
        }
        else if (me.structs[expected.type]) {
            if (t !== "object") {
                return me.validationErr(namePrefix, expected.type, t, val);
            }

            fields = me.getAllStructFields([], me.structs[expected.type]);
            fieldKeys = { };
            for (i = 0; i < fields.length; i++) {
                e = fields[i];
                valid = me.validate(namePrefix+"."+e.name, e, e.is_array, val[e.name]);
                if (!valid[0]) {
                    return valid;
                }
                fieldKeys[e.name] = 1;
            }

            for (i in val) {
                if (val.hasOwnProperty(i) && !fieldKeys[i]) {
                    return [ false, namePrefix+"."+e.name+" does not exist in type '" + 
                             expected.type + "'" ];
                }
            }

            return okRes;
        }
        else if (me.enums[expected.type]) {
            if (t !== "string") {
                return me.validationErr(namePrefix, expected.type, t, val);
            }

            e = me.enums[expected.type];
            for (i = 0; i < e.values.length; i++) {
                if (e.values[i].value === val) {
                    return okRes;
                }
            }

            var msg = namePrefix + " value '" + val + "' is not in the enum '" + 
                e.name + "': " + JSON.stringify(e.values);
            return [ false, msg ];
        }
        else {
            return [ false, namePrefix + " unknown type: " + expected.type ];
        }
    }
};

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

Contract.prototype.validationErr = function(namePrefix, expType, actType, val) {
    return [ false, namePrefix + " expects type '" + expType + "' but got type '" + 
             actType + "' for value: " + val ];
};

function Batch(client) {
    this.client  = client;
    this.reqList = [];
}

Batch.prototype.proxy = function(ifaceName) {
    var me = this;
    return me.client._proxy(function(method) { return me.functionProxy(method); }, ifaceName);
};

Batch.prototype.functionProxy = function(method) {
    var client = this;
    return function() {
        // unlike Client.functionProxy, don't pop the last arg
        // since batch invocations don't supply callbacks
        var args = Array.prototype.slice.call(arguments);
        client.request(method, args);
    };
};

// Sends the batch to the server
//
// callback will be passed two parameters:
//   errors  - Array of errors - null if no errors occurred
//   results - Array of all successful calls
//
// errors is array of objects with keys:
//   method - interface name + "." + function (e.g. "ContactService.put")
//   params - parameters passed to that function for this request
//   error  - error object (keys: code, message, data) 
//
// results is array of objects with keys:
//   method - interface name + "." + function (e.g. "ContactService.put")
//   params - parameters passed to that function for this request
//   result - return value for that request. type is function specific.
//
// a given request will only appear in one of the two arrays, not both
// results will be ordered in the batch call order
//
Batch.prototype.send = function(callback) {
    var me = this;
    var reqList = me.reqList;
    me.client._send(reqList, function(resp) {
        if (resp !== null && resp !== undefined && resp instanceof Array) {

            // reorder results to match the order of the requests,
            // as server may return them in a different order
            var errors = [ ];
            var results = [ ];
            var idToResp = { };
            var i, r, msg;
            for (i = 0; i < resp.length; i++) {
                r = resp[i];
                if (r.id) {
                    idToResp[r.id] = r;
                }
            }

            for (i = 0; i < reqList.length; i++) {
                if (reqList[i].id) {
                    r = idToResp[reqList[i].id];
                    if (r) {
                        r = me.wrapResp(reqList[i], r);
                        if (r.error) {
                            errors.push();
                        }
                        else {
                            results.push(r);
                        }
                    }
                    else {
                        msg = "No response received for request id: " + reqList[i].id;
                        errors.push(me.wrapResp(reqList[i], errResp(-32603, msg)));
                    }
                }
            }

            callback(errors.length === 0 ? null : errors, results);
        }
        else {
            // single error - probably a transport related issue
            // we can't correlate this to any single request, so pass
            // an empty req object to wrapResp
            callback([me.wrapResp({ }, resp)], null);
        }
    });
};

Batch.prototype.wrapResp = function(req, resp) {
    resp.method = req.method;
    resp.params = req.params;
    return resp;
};

Batch.prototype.request = function(method, params) {
    this.reqList.push(makeRequest(method, params));
};

function Client(transport) {
    this.transport = transport;
    this.trace = null;
}

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

Client.prototype.enableTrace = function(logFunc) {
    if (logFunc && (typeof logFunc === "function")) {
        this.trace = logFunc;
    }
    else {
        this.trace = function(s) { console.log(s); };
    }
};

Client.prototype.disableTrace = function() {
    this.trace = null;
};

Client.prototype.batch = function() {
    return new Batch(this);
};

Client.prototype.proxy = function(ifaceName) {
    var me = this;
    return me._proxy(function(method) { return me.functionProxy(method); }, ifaceName);
};

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

Client.prototype.functionProxy = function(method) {
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

Client.prototype.request = function(method, params, callback) {
    var me  = this;
    var req = makeRequest(method, params);

    me._send(req, function(resp) {
        if (resp.error) {
            callback(resp.error, null);
        }
        else {
            callback(null, resp.result);
        }
    });
};

Client.prototype._send = function(req, callback) {
    var me = this;
    if (me.trace) {
        me.trace("Request: " + JSON_stringify(req));
    }

    me.transport(req, function(resp) {
        if (me.trace) {
            me.trace("Response: " + JSON_stringify(resp));
        }

        callback(resp);
    });
};
