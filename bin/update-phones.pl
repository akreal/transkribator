#!/usr/bin/env perl

use Dancer2;
use Dancer2::Plugin::Database;
use File::Slurp;

my @phones = database->quick_select('phones', {}, { 'columns' => ['ipa', 'alternatives'], 'order_by' => {'asc' => 'id'} });
write_file(
			config->{appdir} . '/public/javascripts/phones-ipa.js',
			'var phonemHTML=' . to_json( [ map { $_->{'ipa'} } @phones ] ) .
			';var alternatives=' . to_json( [ map { $_->{'alternatives'} } @phones ] ) . ';'
		);


