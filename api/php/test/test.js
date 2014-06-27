var yaml    = require('js-yaml');
var fs      = require('fs');
var request = require('request');
var Promise = require('es6-promise').Promise;
var _       = require('lodash');
var assert  = require('assert');
var d3      = require('d3');
var jsftp   = require('jsftp');
var jsdiff  = require('diff');
              require('colors');
var moment  = require('moment');

describe('results endpoint', function() {

	// get the list of states from ap.yml
	var ap_yml = yaml.safeLoad(fs.readFileSync('../../config/ap.yml', 'utf8'));
	var states = ap_yml.states.split(',').map(function(v) { return v.trim(); });
	var statesJson;

	before(function(done) {

		function getStateJSON(state) {
			return new Promise(function(resolve, reject) {
				request('http://localhost:3333/api/php/results/index.php?debug=1&detail=1&state=' + state, function(error, response, body) {
					if (response.status = 200) {
						resolve({state: state, results: JSON.parse(body)});
					} else {
						reject(error);
					}
				});
			});
		}

		function getFlatFile(state) {
			return new Promise(function(resolve, reject) {
				var ftp = new jsftp({
					host: ap_yml.host,
					user: ap_yml.user,
					pass: ap_yml.pass,
					debugMode: false
				});

				ftp.on('jsftp_debug', function(eventType, data) {
					console.log('DEBUG: ', eventType);
					console.log(JSON.stringify(data, null, 2));
				});				
				ftp.get(state + '/flat/' + state + '.txt', 'test/temp/' + state + '.txt', function(error) {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
		}

		Promise.all(states.map(getStateJSON))
		.then(function(response) {
			statesJson = response;
			return Promise.all(states.map(getFlatFile));
		}).then(function() {
			done();
		});

	});

	it('should match AP flat file', function(done) {

		statesJson.forEach(function(stateJson) {

			// assemble flat file from json
			var flatFileFromJson = _(stateJson.results)
				.sortBy(function(race) {
					return +race.races_race_number;
				})
				.map(function(race) {

					return _(race.reporting_units)
						.each(function(reporting_unit) {
							reporting_unit.internalOrder =
								+reporting_unit.races_county_number === 1 ? 'AAA' :
								reporting_unit.races_county_name.replace(/ /g, '').toLowerCase();
						})
						.sortBy('internalOrder')
						.map(function(reporting_unit) {

							return _.flatten([
								race.races_test_flag,
								moment(race.races_election_date).format('YYYY-MM-DD'),
								race.races_state_postal,
								reporting_unit.races_county_number,
								reporting_unit.races_fips_code,
								reporting_unit.races_county_name,
								race.races_race_number,
								race.races_office_id,
								race.races_race_type_id,
								race.races_seat_number,
								race.races_office_name,
								race.races_seat_name,
								race.races_race_type_party,
								race.races_race_type,
								race.races_office_description,
								race.races_number_of_winners,
								race.races_number_in_runoff,
								reporting_unit.races_precincts_reporting,
								reporting_unit.races_total_precincts,
								_(reporting_unit.results)
									.sortBy(function(result) {
										return +result.candidates_candidate_number;
									})
									.map(function(result) {
										var candidate = _.find(race.candidates, {candidates_candidate_number: result.candidates_candidate_number});

										return [
											result.candidates_candidate_number,
											result.results_natl_order,
											result.results_party,
											candidate.candidates_first_name,
											candidate.candidates_middle_name,
											candidate.candidates_last_name,
											candidate.candidates_junior,
											candidate.candidates_use_junior,
											result.results_incumbent,
											result.results_vote_count,
											result.results_winner,
											candidate.candidates_politician_id
										];
									})
									.value()
							]).join(';') + ';';
						})
						.value()
				})
				.flatten()
				.value()
				.join('\r\n') + '\r\n';

			fs.writeFileSync('test/temp/' + stateJson.state + '_NEW.txt', flatFileFromJson, 'utf8');

			var flatFile = fs.readFileSync('test/temp/' + stateJson. state + '.txt', 'utf8');

			// var diff = jsdiff.diffChars(flatFile, flatFileFromJson);

			// diff.forEach(function(part){
			// 	// green for additions, red for deletions
			// 	// grey for common parts
			// 	var color = part.added ? 'green' :
			// 	part.removed ? 'red' : 'grey';
			// 	process.stderr.write(part.value[color]);
			// });

			// console.log();

			// console.log(flatFile);

			// console.log(flatFileFromJson);

			// assert.strictEqual(flatFile, flatFileFromJson);

		});

		done();

	});

});
