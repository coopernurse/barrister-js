var fs = require('fs');
var barrister = require('barrister');

var inFile    = process.argv[2];
var outFile   = process.argv[3];
var outStream = fs.createWriteStream(outFile);
var array     = fs.readFileSync(inFile).toString().split("\n");
var commands  = [ ];
var i, line, cols, method, batch, batchCols, client;

// Read conform.in into array. Skip comments and blank lines.
for (i=0; i < array.length; i++) {
    line = array[i].trim();
    if (line && line !== "" && line.indexOf("#") !== 0) {
        commands.push(line);
    }
}

function nextCommand() {
    if (commands.length === 0) {
        return;
    }

    var line = commands.shift();
    if (line === "start_batch") {
        batch = client.batch();
        batchCols = [];
        nextCommand();
    }
    else if (line === "end_batch") {
        batch.send(function(errors, results) {
            var s;

            if (errors) {
                for (x = 0; x < errors.length; x++) {
                    s = "|rpcerr|" + errors[x].error.code;
                    outStream.write(cols[0] + "|" + cols[1] + "|" + cols[2] + s + "\n");
                    outStream.flush();
                }
            }

            for (x = 0; x < results.length; x++) {
                result = results[x];
                cols   = batchCols[x];
                if (!result) {
                    s = "|err|null result!!";
                }
                else {
                    s = "|ok|" + barrister.JSON_stringify(result.result);
                }

                outStream.write(cols[0] + "|" + cols[1] + "|" + cols[2] + s + "\n");
                outStream.flush();
            }
            batch = null;
            batchCols = null;
            nextCommand();
        });
    }
    else {
        (function() {
            var cols = line.split("|");
            method = cols[0] + "." + cols[1];

            if (batchCols) {
                batchCols.push(cols);
                batch.request(method, JSON.parse(cols[2]));
                nextCommand();
            }
            else {
                client.request(method, JSON.parse(cols[2]), function(error, result) {
                    if (error) {
                        s = "|rpcerr|" + error.code;
                    }
                    else {
                        s = "|ok|" + barrister.JSON_stringify(result);
                    }

                    outStream.write(cols[0] + "|" + cols[1] + "|" + cols[2] + s + "\n");
                    outStream.flush();
                    nextCommand();
                });
            }
        })();
    }
}

// Create barrister client
var onErr = function(msg) {
    console.log("Error initializing Client: " + msg);
    process.exit(1);
};

client = barrister.httpClient("http://localhost:9233/");
client.enableTrace();
client.loadContract(function(err) {
    nextCommand();
});
