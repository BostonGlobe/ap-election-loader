var yaml    = require('js-yaml');
var fs      = require('fs');
var request = require('request');
var Promise = require('es6-promise').Promise;
var _       = require('lodash');
var assert  = require('assert');
var d3      = require('d3');

describe('results endpoint', function() {

	// get the list of states from ap.yml
	var doc = yaml.safeLoad(fs.readFileSync('../../config/ap.yml', 'utf8'));
	var states = doc.states.split(',').map(function(v) { return v.trim(); });
	var statesJson;

	before(function(done) {

		function getStateJSON(state) {
			return new Promise(function(resolve, reject) {
				request('http://localhost:3333/api/php/results/index.php?debug=1&state=' + state, function(error, response, body) {
					if (response.status = 200) {
						resolve({state: state, results: JSON.parse(body)});
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

		assert(_.isEqual(states, statesJson.map(function(v) {

			// read STATE_Candidate.txt
			var file = fs.readFileSync('../../data/' + v.state + '/' + v.state + '_Candidate.txt', 'utf8');

			// parse in so we can order by something
			// because AP doesn't order the rows
			var dsv = d3.dsv(';', 'text/plain');
			var fileRows = _(dsv.parseRows(file, function(row, index) {
					return _.zipObject([
						'test_flag',
						'id',
						'candidate_number',
						'first_name',
						'middle_name',
						'last_name',
						'junior',
						'use_junior',
						'politician_id'
					], row);
				}))
				// sort by id
				.sortBy(function(v) {
					return +v.id;
				})
				// convert object into array of values
				.map(function(v, i) {
					return _.values(v);
				})
				.value();

			// write file to temp directory for comparison later
			fs.writeFileSync('test/temp/' + v.state + '_Candidate.txt', dsv.formatRows(fileRows), 'utf8');




			// return v.state;
		})));

		done();

	});

});










