function okResp(id, result) {
    id = id || null;
    return { "jsonrpc": "2.0", "id": id, "result": result };
}

function Server(idl) {
    this.handlers = { };
    this.contract = new Contract(idl);
}

Server.prototype.addHandler = function(iface, handler) {
    this.handlers[iface] = handler;
};

Server.prototype.handleJSON = function(reqJSON, onComplete) {
    var req;
    try {
        req = JSON.parse(reqJSON);
    }
    catch (e) {
        onComplete(JSON_stringify(errResp(null, -32700, "Unable to parse JSON: " + reqJSON)));
        return;
    }

    this.handle(req, function(resp) {
        var respJSON = JSON_stringify(resp);
        //console.log("Resp: " + respJSON);
        onComplete(respJSON);
    });
};

Server.prototype.handle = function(req, onComplete) {
    var me = this;
    var resp, i;
    if (req instanceof Array) {
        resp = [ ];
        var callback = function(res) {
            resp.push(res);
            if (resp.length === req.length) {
                return onComplete(resp);
            }
            //console.log("req.length=" + req.length + " resp.length=" + resp.length);
        };

        //console.log("batch request length: " + req.length);

        if (req.length > 0) {
            for (i = 0 ; i < req.length; i++) {
                me.handleSingle(req[i], callback);
            }
        }
        else {
            onComplete(errResp(req.id, -32600, "Request contains empty batch"));
        }
    }
    else {
        me.handleSingle(req, onComplete);
    }
};

Server.prototype.handleSingle = function(req, onComplete) {
    var me = this;
    var i, msg, errObj;
    if (req.method) {
        if (req.method === "barrister-idl") {
            return onComplete(okResp(req.id, me.contract.idl));
        }

        var pos = req.method.indexOf(".");
        if (pos === -1) {
            return onComplete(errResp(req.id, -32601, "Method not found: " + req.method));
        }

        var ifaceName = req.method.substring(0, pos);
        var funcName  = req.method.substring(pos+1);

        var iface   = me.contract.interfaces[ifaceName];
        var func    = me.contract.functions[req.method];
        var handler = me.handlers[ifaceName];

        if (iface && func && handler && handler[funcName]) {
            errObj = me.contract.validateReq(req);
            if (errObj !== null) {
                return onComplete(errObj);
            }

            var paramLen = req.params ? req.params.length : 0;
            var callParams = [];
            if (paramLen > 0) {
                callParams = callParams.concat(req.params);
            }
            callParams.push(function(err, result) {
                if (err === null || err === undefined) {
                    onComplete(okResp(req.id, result));
                }
                else {
                    var t = typeof err;
                    var errObj;
                    if (t === "object") {
                        errObj = errResp(req.id, -32000, err.code, err.message, err.data);
                    }
                    else if (t === "number") {
                        errObj = errResp(req.id, err, "Server error: " + err);
                    }
                    else {
                        errObj = errResp(req.id, -32000, err);
                    }

                    onComplete(errObj);
                }
            });
            handler[funcName].apply(handler, callParams);
        }
        else {
            return onComplete(errResp(req.id, -32601, "Method not found: " + req.method));
        }
    }
    else {
        return onComplete(errResp(req.id, -32600, "Request did not contain a method"));
    }
};
