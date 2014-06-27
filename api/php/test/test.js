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
					debugMode: true
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
					return +race.race_number;
				})
				.map(function(race) {

					return _(race.reporting_units)
						.each(function(reporting_unit) {
							reporting_unit.internalOrder =
								+reporting_unit.county_number === 1 ? 'AAA' :
								reporting_unit.county_name.replace(/ /g, '').toLowerCase();
						})
						.sortBy('internalOrder')
						.map(function(reporting_unit) {

							return _.flatten([
								race.test_flag,
								moment(race.election_date).format('YYYY-MM-DD'),
								race.state,
								reporting_unit.county_number,
								reporting_unit.fips_code,
								reporting_unit.county_name,
								race.race_number,
								race.office_id,
								race.race_type_id,
								race.seat_number,
								race.office_name,
								race.seat_name,
								race.race_type_party,
								race.race_type,
								race.office_description,
								race.number_of_winners,
								race.number_in_runoff,
								reporting_unit.precincts_reporting,
								reporting_unit.total_precincts,
								_(reporting_unit.results)
									.sortBy(function(result) {
										return +result.candidate_number;
									})
									.map(function(result) {
										var candidate = _.find(race.candidates, {candidate_number: result.candidate_number});

										return [
											result.candidate_number,
											result.natl_order,
											result.party,
											candidate.first_name,
											candidate.middle_name,
											candidate.last_name,
											candidate.junior,
											candidate.use_junior,
											result.incumbent,
											result.vote_count,
											result.winner,
											candidate.politician_id
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

			assert.strictEqual(flatFile, flatFileFromJson);

		});

		done();

	});

});
