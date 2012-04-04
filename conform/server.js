var fs        = require('fs');
var http      = require('http');
var barrister = require('barrister');
var numCpus   = require('os').cpus().length;
var i;

var A = function() {
    var me = {};

    me.add = function(a, b, callback) {
        callback(null, a+b);
    };

    me.calc = function(nums, op, callback) {
        var i, total = 0;
        if (op === "multiply") {
            total = 1;
        }

        for (i = 0; i < nums.length; i++) {
            if (op === "add") {
                total += nums[i];
            }
            else if (op === "multiply") {
                total = total * nums[i];
            }
        }

        callback(null, total);
    };

    me.sqrt = function(a, callback) {
        callback(null, Math.sqrt(a));
    };

    me.repeat = function(req, callback) {
        var i;
        var resp = { status: "ok", count: req.count, items: [] };
        var s = req.force_uppercase ? req.to_repeat.toUpperCase() : req.to_repeat;
        for (i = 0; i < req.count; i++) {
            resp.items.push(s);
        }
        callback(null, resp);
    };

    me.repeat_num = function(num, count, callback) {
        var l = [ ];
        var i;
        for (i = 0; i < count; i++) {
            l.push(num);
        }
        callback(null, l);
    };

    me.say_hi = function(callback) {
        callback(null, { hi: "hi" });
    };

    me.putPerson = function(person, callback) {
        callback(null, person.personId);  
    };

    return me;
};

var B = function() {
    var me = {};

    me.echo = function(s, callback) {
        var retval = null;
        if (s !== "return-null") {
            retval = s;
        }
        callback(null, retval);
    };

    return me;
};


var idlFile = process.argv[2] || "conform.json";
var server  = new barrister.Server(JSON.parse(fs.readFileSync(idlFile).toString()));
server.addHandler("A", new A());
server.addHandler("B", new B());

http.createServer(function (req, res) {
    if (req.url === '/exit') {
        setTimeout(function() {
            process.exit(0);
        }, 50);
        res.end("ok");
    }
    else {
        var data = "";
        req.on("data", function(c) { data += c; });
        req.on("end", function() {
            server.handleJSON(data, function(resp) {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(resp);
            });
        });
    }
}).listen(9233);
