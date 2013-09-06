//
// NOTES:
//
//   - The service initialization is asynchronous, so there's a race condition.
//     RPC.Calculator may not be ready when CalcCntl.add/subtract are called
//   - This can be solved a few ways, but I didn't want to complicate the example
//     with that, as it depends on how your app is actually setup.  See:
//     http://stackoverflow.com/questions/16286605/initialize-angularjs-service-with-asynchronous-data
//   - The "endpoints" array to RPC object mapping assumes that your set of interface names
//     is unique across all endpoints.  If that doesn't hold for your system, then you'll
//     need to add an endpoint id to the names to make them unique.
//

var app = angular.module("calcApp", []);

app.service("RPC", function($http) {
	var i, RPC = {},

		// update this list with all Barrister endpoints and interfaces you want
		// to expose
		endpoints = [{
			url: "/api/calc",
			interfaces: ["Calculator"]
		}],

		clientOpts = {
			// automatically convert JS types to conform to IDL types
			// if it can be done w/o data loss (e.g. "1" -> 1, "true" -> true)
			coerce: true
		};


	function initClient(endpoint) {
		var transport = function(req, callback) {
			$http.post(endpoint.url, Barrister.JSON_stringify(req))
				.success(function(data, status, headers, config) {
					callback(Barrister.parseResponse(req, null, data));
				})
				.error(function(data, status, headers, config) {
					callback(Barrister.parseResponse(req, status + " data: " + data, null));
				});
		},
			client = new Barrister.Client(transport, clientOpts);

		client.loadContract(function(err) {
			var i, name;
			if (err) {
				alert("Unable to load contract: " + Barrister.JSON_stringify(err));
			} else {
				for (i = 0; i < endpoint.interfaces.length; i++) {
					name = endpoint.interfaces[i];
					RPC[name] = client.proxy(name);
				}
			}
		});
	}

	for (i = 0; i < endpoints.length; i++) {
		initClient(endpoints[i]);
	}

	return RPC;
});

app.controller("CalcCntl", ["$scope", "RPC",
	function($scope, RPC) {

		var showResult = function(err, result) {
			if (err) {
				$scope.result = "ERR: " + Barrister.JSON_stringify(err);
			} else {
				$scope.result = result;
			}
		};

		$scope.add = function() {
			$scope.result = RPC.Calculator.add($scope.x, $scope.y, showResult);
		};

		$scope.subtract = function() {
			$scope.result = RPC.Calculator.subtract($scope.x, $scope.y, showResult);
		};
	}
]);