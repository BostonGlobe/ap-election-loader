<?php

use Symfony\Component\Yaml\Parser;

$yaml = new Parser();
$database_config = $yaml->parse(file_get_contents('../../../config/database.yml'));

$db = new mysqli(
	$database_config['development']['host'],
	$database_config['development']['username'],
	$database_config['development']['password'],
	$database_config['development']['database']
);

?>
