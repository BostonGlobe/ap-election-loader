var yaml    = require('js-yaml');
var fs      = require('fs');
var request = require('request');
var Promise = require('es6-promise').Promise;
var _       = require('lodash');

describe('results endpoint', function() {

	// get the list of states from ap.yml
	var doc = yaml.safeLoad(fs.readFileSync('../../config/ap.yml', 'utf8'));
	var states = doc.states.split(',').map(function(v) { return v.trim(); });
	var statesJson;

	before(function(done) {

		function getStateJSON(state) {
			return new Promise(function(resolve, reject) {
				request('http://localhost:3333/api/php/results/index.php?state=' + state, function(error, response, body) {
					if (response.status = 200) {
						resolve(JSON.parse(body));
					} else {
						reject(error);
					}
				});
			});
		}

		Promise.all(states.map(getStateJSON))
		.then(function(response) {

			statesJson = response;

			done();
		});

	});

	it('should match STATE_Candidate.txt', function(done) {

		console.log(JSON.stringify(statesJson, null, 4));
		done();

	});

});