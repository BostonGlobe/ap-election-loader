<?php

require_once '../vendor/autoload.php';
require_once 'db.php';

use Underscore\Types\Arrays;

ob_start('ob_gzhandler');
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

// make sure state query param is valid
$STATE = isset($_GET['state']) ? strtoupper($_GET['state']) : '';
$STATE_CLAUSE = '';
if (preg_match('/^[a-zA-Z]{2}$/', $STATE)) {
	$STATE_CLAUSE = sprintf("ap_races.state_postal = '%s'", $STATE);
} else {
	$STATE_CLAUSE = '1=1';
}

// make sure race query param is valid
$RACE = isset($_GET['race']) ? $_GET['race'] : '';
$RACE_CLAUSE = '';
if (preg_match('/^\d+$/', $RACE)) {
	$RACE_CLAUSE = sprintf('ap_races.race_number = %s', $RACE);
} else {
	$RACE_CLAUSE = '1=1';
}

// make sure detail query param is valid
$DETAIL = isset($_GET['detail']) ? $_GET['detail'] : '';
$DETAIL_CLAUSE = '';
if ($DETAIL == '1') {
	$DETAIL_CLAUSE = '1=1';
} else {
	$DETAIL_CLAUSE = 'ap_races.county_number = 1';
}

// make sure debug query param is valid
$DEBUG = isset($_GET['debug']) ? (boolean) $_GET['debug'] : False;

$query = "SELECT ap_candidates.test_flag as candidates_test_flag, ap_candidates.id as candidates_id, ap_candidates.candidate_number as candidates_candidate_number, ap_candidates.first_name as candidates_first_name, ap_candidates.middle_name as candidates_middle_name, ap_candidates.last_name as candidates_last_name, ap_candidates.junior as candidates_junior, ap_candidates.use_junior as candidates_use_junior, ap_candidates.politician_id as candidates_politician_id, ap_races.test_flag as races_test_flag, ap_races.id as races_id, ap_races.race_number as races_race_number, ap_races.election_date as races_election_date, ap_races.state_postal as races_state_postal, ap_races.county_number as races_county_number, ap_races.fips_code as races_fips_code, ap_races.county_name as races_county_name, ap_races.office_id as races_office_id, ap_races.race_type_id as races_race_type_id, ap_races.seat_number as races_seat_number, ap_races.office_name as races_office_name, ap_races.seat_name as races_seat_name, ap_races.race_type_party as races_race_type_party, ap_races.race_type as races_race_type, ap_races.office_description as races_office_description, ap_races.number_of_winners as races_number_of_winners, ap_races.number_in_runoff as races_number_in_runoff, ap_races.precincts_reporting as races_precincts_reporting, ap_races.total_precincts as races_total_precincts, ap_races.last_updated as races_last_updated, ap_results.test_flag as results_test_flag, ap_results.ap_race_id as results_ap_race_id, ap_results.ap_candidate_id as results_ap_candidate_id, ap_results.party as results_party, ap_results.incumbent as results_incumbent, ap_results.vote_count as results_vote_count, ap_results.winner as results_winner, ap_results.natl_order as results_natl_order, ap_results.winner_override as results_winner_override FROM ap_races INNER JOIN ap_results ON ap_races.id = ap_results.ap_race_id AND " . $STATE_CLAUSE . " AND " . $RACE_CLAUSE . " AND " . $DETAIL_CLAUSE . " INNER JOIN ap_candidates ON ap_results.ap_candidate_id = ap_candidates.id";

$data = $db->query($query);

// fetch records from db
$records = array();
while ($record = mysqli_fetch_assoc($data)) { $records[] = $record; }

$races = Arrays::from($records)
	->group('races_race_number')
	->each(function($value) {

		$race = array(
			'test_flag'          => $value[0]['races_test_flag'],
			'race_number'        => $value[0]['races_race_number'],
			'election_date'      => $value[0]['races_election_date'],
			'state'              => $value[0]['races_state_postal'],
			'office_id'          => $value[0]['races_office_id'],
			'race_type_id'       => $value[0]['races_race_type_id'],
			'seat_number'        => $value[0]['races_seat_number'],
			'office_name'        => $value[0]['races_office_name'],
			'seat_name'          => $value[0]['races_seat_name'],
			'race_type_party'    => $value[0]['races_race_type_party'],
			'race_type'          => $value[0]['races_race_type'],
			'office_description' => $value[0]['races_office_description'],
			'number_of_winners'  => $value[0]['races_number_of_winners'],
			'last_updated'       => $value[0]['races_last_updated']
		);

		if ($GLOBALS['DEBUG']) {
			$race['number_in_runoff'] = $value[0]['races_number_in_runoff'];
		}

		$race['candidates'] = Arrays::from($value)
			->group('candidates_candidate_number')
			->each(function($value) {

				$candidate = array(
					'candidate_number' => $value[0]['candidates_candidate_number'],
					'first_name'       => $value[0]['candidates_first_name'],
					'middle_name'      => $value[0]['candidates_middle_name'],
					'last_name'        => $value[0]['candidates_last_name'],
					'junior'           => $value[0]['candidates_junior'],
					'use_junior'       => $value[0]['candidates_use_junior'],
					'politician_id'    => $value[0]['candidates_politician_id']
				);

				if ($GLOBALS['DEBUG']) {
					$candidate['candidates_id'] = $value[0]['candidates_id'];
				}

				return $candidate;

			})
			->values()
			->obtain();

		$race['reporting_units'] = Arrays::from($value)
			->group('races_county_number')
			->each(function($value) {

				$reportingUnit = array(
					'county_number'       => $value[0]['races_county_number'],
					'fips_code'           => $value[0]['races_fips_code'],
					'county_name'         => $value[0]['races_county_name'],
					'precincts_reporting' => $value[0]['races_precincts_reporting'],
					'total_precincts'     => $value[0]['races_total_precincts']
				);

				$reportingUnit['results'] = Arrays::from($value)
					->each(function($value) {

						return array(
							'candidate_number' => $value['candidates_candidate_number'],
							'party'            => $value['results_party'],
							'incumbent'        => $value['results_incumbent'],
							'vote_count'       => $value['results_vote_count'],
							'winner'           => $value['results_winner'],
							'natl_order'       => $value['results_natl_order'],
							'winner_override'  => $value['results_winner_override']
						);
					})
					->values()
					->obtain();

				return $reportingUnit;

			})
			->values()
			->obtain();

		return $race;

	})
	->values()
	->obtain();

echo json_encode($races);

?>