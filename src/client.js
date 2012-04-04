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
                valid = me.validate(namePrefix+"."+e.name, e, false, val[e.name]);
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
    this.client = client;
    this.reqList = [];
}

Batch.prototype.send = function(onComplete) {
    var me = this;
    var reqJson = JSON_stringify(me.reqList, true);
    console.log("Sending batch: " + reqJson);
    var options = {
        url: me.client.endpoint,
        method: "POST",
        headers: {
            contentType: "application/json"
        },
        body: reqJson
    };
    request(options, function(error, response, body) {
        if (error) {
            onComplete({ code: -32000, message: error}, null, null);
        }
        else {
            var resp;
            try {
                resp = JSON.parse(body);
            }
            catch (e) {
                return onComplete(errResp(null, -32700, "Unable to parse JSON: " + body));
            }
            onComplete(null, resp, me.reqList);
        }
    });
};

Batch.prototype.request = function(method, params) {
    this.reqList.push(makeRequest(method, params));
};

function Client(endpoint, onError, onSuccess) {
    this.endpoint = endpoint;
    this.request("barrister-idl", [], function(resp) {
        onError(resp.message);
    }, function(resp) {
        this.contract = new Contract(resp);
        onSuccess();
    });
}

Client.prototype.request = function(method, params, onError, onSuccess) {
    var req     = makeRequest(method, params);
    var reqJson = JSON_stringify(req, true);
    console.log("sending post: method=" + method);

    var options = {
        url: this.endpoint,
        method: "POST",
        headers: {
            contentType: "application/json"
        },
        body: reqJson
    };
    request(options, function(error, response, body) {
        if (error) {
            onError({ code: -32000, message: error}, req, body);
        }
        else {
            console.log("client parsing: " + body);
            var resp;
            if (body !== undefined && body !== null) {
                resp = JSON.parse(body);
            }
            else {
                resp = errResp(req.id, -32603, "Null response body received from server");
            }

            if (resp.error) {
                onError(resp.error, req, body);
            }
            else {
                onSuccess(resp.result, req);
            }
        }
    });
};

Client.prototype.startBatch = function() {
    return new Batch(this);
};
