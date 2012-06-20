var barrister = require('../dist/barrister.node.js');
var assert    = require('chai').assert;
var fs        = require('fs');

var contract;

describe("type coercion - default implementation", function() {
    
    beforeEach(function() {
        var idl  = JSON.parse(fs.readFileSync(__dirname + "/sample.json").toString());
        var server = new barrister.Server(idl);
        var client = barrister.inprocClient(server, { coerce: true });
        client.loadContract(function() { } );
        contract = client.contract;
    });
    
    it("coerces bool to string", function() {
        assert.strictEqual("true", contract.coerceRecursive("string", false, true));
        assert.strictEqual("false", contract.coerceRecursive("string", false, false));
    });
    
    it("coerces int to string", function() {
        assert.strictEqual("2322", contract.coerceRecursive("string", false, 2322));
        assert.strictEqual("-122", contract.coerceRecursive("string", false, -122));
    });
    
    it("coerces float to string", function() {
        assert.strictEqual("-232.322", contract.coerceRecursive("string", false, -232.322));
        assert.strictEqual("3221.001", contract.coerceRecursive("string", false, 3221.001));
    });
    
    it("coerces string to int", function() {
        assert.strictEqual(-32, contract.coerceRecursive("int", false, "-32"));
        assert.strictEqual(949, contract.coerceRecursive("int", false, "949"));
    });
    
    it("coerces string to float", function() {
        assert.strictEqual(-32.301, contract.coerceRecursive("float", false, "-32.301"));
        assert.strictEqual(949.0101, contract.coerceRecursive("float", false, "949.0101"));
    });
    
    it("coerces string to bool", function() {
        assert.strictEqual(true, contract.coerceRecursive("bool", false, "true"));
        assert.strictEqual(false, contract.coerceRecursive("bool", false, "false"));
    });
    
    it("returns val if coerce fails", function() {
        // [0] = value
        // [1] = barrister primitive type to coerce to (which should fail)
        var i, c;
        var cases = [
            [ 10,  "bool" ],
            [ 3.2, "bool" ],
            [ "a", "int" ],
            [ " ", "int" ],
            [ "a", "float" ],
            [ true, "float" ],
            [ false, "int" ]
        ];
        
        for (i = 0; i < cases.length; i++) {
            c = cases[i];
            assert.strictEqual(c[0], contract.coerceRecursive(c[1], false, c[0]));
        }
    });
    
    it("coerces array members if possible", function() {
        var i, c;
        var cases = [
            [ "bool",   [ "a", "true", "false" ],  ["a", true, false] ],
            [ "int",    [ -32, true, "99" ],       [-32, true, 99] ],
            [ "int",    [ -93.2, "true", "93.2" ], [-93.2, "true", "93.2"] ],
            [ "float",  ["-2.01", "true", "0" ],   [-2.01, "true", 0] ],
            [ "string", [ "a", true, 3 ],          ["a", "true", "3"] ],
            [ "string", [ -32.1, "true", false ],  ["-32.1", "true", "false"] ],
        ];
        for (i = 0; i < cases.length; i++) {
            c = cases[i];
            assert.deepEqual(c[2], contract.coerceRecursive(c[0], true, c[1]));
        }
    });
    
    it("coerces object properties if possible", function() {
        var i, c;
        var cases = [
            [ "Role",   { id: 1, name: 33 },  { id: 1, name: "33" } ],
            [ "Role",   { id: "33", name: "hi" },  { id: 33, name: "hi" } ],
            [ "Role",   { id: "true", name: true },  { id: "true", name: "true" } ]
        ];
        for (i = 0; i < cases.length; i++) {
            c = cases[i];
            assert.deepEqual(c[2], contract.coerceRecursive(c[0], false, c[1]));
        }
    });
    
    it("passes type validation post-coercion", function() {
        var params = [ 32, "3211" ];
        assert.isNull(contract.validateReq({ "method" : "UserService.create", "params" : params }));
        
        params = [ { "id" : "322", "name" : true, "active" : "true", "age" : "32.22", "roles" : [ ] } ];
        assert.isNull(contract.validateReq({ "method" : "UserService.update", "params" : params }));
    });
    
});