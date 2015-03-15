#!/usr/bin/env perl

use strict;
use warnings;

use Gearman::XS qw(:constants);
use Gearman::XS::Worker;
use Gearman::XS::Client;

use File::Slurp;
use File::Temp 'tempdir';
use File::Path 'rmtree';
use Capture::Tiny 'capture';

use Dancer2;
use Dancer2::Plugin::Database;

my $model = $ENV{'KALDIMODEL'};
my $beam = 10.0;
my $acoustic_scale = 0.083;
my $lattice_beam = 6.0;

my $gearman = config()->{'plugins'}->{'GearmanXS'};

my $worker = Gearman::XS::Worker->new();

my $ret = $worker->add_server( @{$gearman}{'host', 'port'} );

if ($ret != GEARMAN_SUCCESS) {
	error($worker->error());
	exit(1);
}

$ret = $worker->add_function('convert', 0, \&convert, {});
if ($ret != GEARMAN_SUCCESS) {
	error($worker->error());
}

$ret = $worker->add_function('transkript', 0, \&transkript, {});
if ($ret != GEARMAN_SUCCESS) {
	error($worker->error());
}

my $client = Gearman::XS::Client->new();
$ret = $client->add_server( @{$gearman}{'host', 'port'} );
if ($ret != GEARMAN_SUCCESS) {
	error('Client died with error:' . $client->error());
	exit(1);
}

while (1) {
	my $ret = $worker->work();
	if ($ret != GEARMAN_SUCCESS) {
		error('Worker died with error:' . $worker->error());
		exit(1);
	}
}

sub convert {
	my $job = shift;

	my $id = $job->workload();

	my $meta = database->quick_select('recordings', { 'id' => $id }, ['datafile', 'filename']);

	my $tmpdir = tempdir();

	my $path = "$tmpdir/$meta->{'filename'}";
	my $cpath = "$path.wav";

	export($meta->{'datafile'}, $path);

	cmd("sox \"$path\" -r16k \"$cpath\"");

	database->quick_insert('files', {
										'data'			=> database->pg_lo_import($cpath),
										'properties'	=> '{"content_type":"audio/x-wav"}',
									}
	);

	database->quick_update('recordings', { 'id' => $id },
			{ 'cdatafile' => database->last_insert_id(undef, undef, 'files', undef) }
	);

	$client->do_background('transkript', $id);

	rmtree($tmpdir);
}

sub transkript {
	my $job = shift;

	my $id = $job->workload();

	my $tmpdir = tempdir();

	my $file = "$tmpdir/file.wav";
	export(database->quick_lookup('recordings', { 'id' => $id }, 'cdatafile'), $file);

	write_file("$tmpdir/wav.scp", "utt $file\n");
	write_file("$tmpdir/utt2spk", "utt anonymous\n");
	write_file("$tmpdir/spk2utt", "anonymous utt\n");

	cmd("compute-mfcc-feats  --verbose=2 --use-energy=false scp:$tmpdir/wav.scp ark:- | ".
		"copy-feats --compress=false ark:- ark,scp:$tmpdir/feats.ark,$tmpdir/feats.scp");
	cmd("compute-cmvn-stats --spk2utt=ark:$tmpdir/spk2utt scp:$tmpdir/feats.scp ark,scp:$tmpdir/cmvn.ark,$tmpdir/cmvn.scp");
	cmd("gmm-latgen-faster --allow-partial=true --beam=$beam --acoustic-scale=$acoustic_scale ".
		"--lattice-beam=$lattice_beam $model/final.alimdl $model/HCLG.fst \"ark,s,cs:apply-cmvn --norm-vars=false ".
		"--utt2spk=ark,t:$tmpdir/utt2spk scp:$tmpdir/cmvn.scp scp:$tmpdir/feats.scp ark:- | splice-feats  ark:- ark:- | ".
		"transform-feats $model/final.mat ark:- ark:- |\" \"ark,t:|gzip -c > $tmpdir/utt.lat.gz\"");
	cmd("gunzip -c $tmpdir/utt.lat.gz | lattice-to-post --acoustic-scale=$acoustic_scale ark:- ark:- | ".
		"weight-silence-post 0.01 1:2:3:4:5 $model/final.alimdl ark:- ark:- | ".
		"gmm-est-fmllr --fmllr-update-type=full --spk2utt=ark:$tmpdir/spk2utt $model/final.mdl ".
		"\"ark,s,cs:apply-cmvn --norm-vars=false --utt2spk=ark:$tmpdir/utt2spk scp:$tmpdir/cmvn.scp ".
		"scp:$tmpdir/feats.scp ark:- | splice-feats ark:- ark:- | transform-feats $model/final.mat ark:- ark:- |".
		"\" ark,s,cs:- ark:$tmpdir/pre_trans");
	cmd("gmm-latgen-faster --max-active=7000 --beam=$beam --lattice-beam=$lattice_beam --acoustic-scale=$acoustic_scale ".
		"--determinize-lattice=false --allow-partial=true  $model/final.mdl $model/HCLG.fst ".
		"\"ark,s,cs:apply-cmvn --norm-vars=false --utt2spk=ark:$tmpdir/utt2spk scp:$tmpdir/cmvn.scp ".
		"scp:$tmpdir/feats.scp ark:- | splice-feats  ark:- ark:- | transform-feats $model/final.mat ark:- ark:- | ".
		"transform-feats --utt2spk=ark:$tmpdir/utt2spk ark:$tmpdir/pre_trans ark:- ark:- |\" ".
		"\"ark:|gzip -c > $tmpdir/lat.tmp.gz\" ark,t:$tmpdir/tra.tra ark:- | ".
		"ali-to-phones --write-lengths=true $model/final.mdl ark:- ark,t:$tmpdir/utt.tra");

	my $transcription = [ map { [ map {$_ + 0} split(' ', $_)  ] } split(' ; ', substr(read_file("$tmpdir/utt.tra"), 4)) ];

	database->quick_insert('transcriptions', { 'utterance' => $id, 'transcription' => $transcription });

	rmtree($tmpdir);
}

sub export {
	my ($id, $path) = @_;
	my $loid = database->quick_lookup('files', { 'id' => $id }, 'data');
	database->pg_lo_export($loid, $path);
}

sub cmd {
	my $cmd = shift;
	my ($stdout, $stderr, $exit) = capture { system('/bin/bash', '-c', $cmd) };
	error("Non-zero status $exit for\n$cmd\n$stderr\n") if $exit != 0;
}

