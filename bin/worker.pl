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

my $lium_cmd = "java -Xmx1024m -classpath $ENV{'LIUMROOT'}/lib/LIUM_SpkDiarization-4.2.jar";
my $lium_model = $ENV{'LIUMMODEL'};
my $ubm = "$lium_model/ubm.gmm";
my $pmsgmm = "$lium_model/sms.gmms";
my $sgmm = "$lium_model/s.gmms";
my $ggmm = "$lium_model/gender.gmms";
my $f_input_desc="audio2sphinx,1:1:0:0:0:0,13,0:0:0";

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

sub segmentate {
	my $job = shift;

	my $id = $job->workload();

	my $workdir = tempdir();

	my $features = "$workdir/file.wav";
	export(database->quick_lookup('recordings', { 'id' => $id }, 'cdatafile'), $features);

	my $uem = "$workdir/show.uem.seg";
	write_file($uem, 'file 1 0 1000000000 U U U 1');

	my $iseg = "$workdir/show.i.seg";
	my $pmsseg = "$workdir/show.pms.seg";
	my $adjseg = "$workdir/show.adj.h.seg";

	# Check the validity of the MFCC
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MSegInit " .
		"--fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$uem --sOutputMask=$workdir/show.i.seg show");

	# Speech / non-speech segmentation using a set of GMMs
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MDecode " .
		"--fInputDesc=audio2sphinx,1:3:2:0:0:0,13,0:0:0 --fInputMask=$features --sInputMask=$iseg " .
		"--sOutputMask=$pmsseg --dPenality=500,500,10 --tInputMask=$pmsgmm show");

	# GLR-based segmentation, make small segments
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MSeg " .
		"--kind=FULL --sMethod=GLR --fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.i.seg " .
		"--sOutputMask=$workdir/show.s.seg show");

	# Linear clustering, fuse consecutive segments of the same speaker from the start to the end
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MClust " .
		"--fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.s.seg " .
		"--sOutputMask=$workdir/show.l.seg --cMethod=l --cThr=2.5 show");

	# Hierarchical bottom-up BIC clustering
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MClust " .
		"--fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.l.seg " .
		"--sOutputMask=$workdir/show.h.seg --cMethod=h --cThr=6 show");

	# Initialize one speaker GMM with 8 diagonal Gaussian components for each cluster
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MTrainInit " .
		"--nbComp=8 --kind=DIAG --fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.h.seg " .
		"--tOutputMask=$workdir/show.init.gmms show");

	# EM computation for each GMM
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MTrainEM " .
		"--nbComp=8 --kind=DIAG --fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.h.seg " .
		"--tOutputMask=$workdir/show.gmms  --tInputMask=$workdir/show.init.gmms show");

	# Viterbi decoding using the set of GMMs trained by EM
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MDecode " .
		"--fInputMask=$features --fInputDesc=$f_input_desc --sInputMask=$workdir/show.h.seg " .
		"--sOutputMask=$workdir/show.d.seg --dPenality=250 --tInputMask=$workdir/show.gmms show");

	# Adjust segment boundaries near silence sections
	cmd("$lium_cmd fr.lium.spkDiarization.tools.SAdjSeg " .
		"--fInputMask=$features --fInputDesc=audio2sphinx,1:1:0:0:0:0,13,0:0:0 --sInputMask=$workdir/show.d.seg " .
		"--sOutputMask=$adjseg show");

	# Filter speaker segmentation according to speech / non-speech segmentation
	my $flt1seg = "$workdir/show.flt1.seg";

	cmd("$lium_cmd fr.lium.spkDiarization.tools.SFilter " .
		"--fInputDesc=audio2sphinx,1:3:2:0:0:0,13,0:0:0 --fInputMask=$features --fltSegMinLenSpeech=150 --fltSegMinLenSil=25 " .
		"--sFilterClusterName=music --fltSegPadding=25 --sFilterMask=$pmsseg --sInputMask=$adjseg --sOutputMask=$flt1seg show");

	my $flt2seg = "$workdir/show.flt2.seg";

	cmd("$lium_cmd fr.lium.spkDiarization.tools.SFilter " .
		"--fInputDesc=audio2sphinx,1:3:2:0:0:0,13,0:0:0 --fInputMask=$features --fltSegMinLenSpeech=150 --fltSegMinLenSil=25 " .
		"--sFilterClusterName=jingle --fltSegPadding=25 --sFilterMask=$pmsseg --sInputMask=$flt1seg --sOutputMask=$flt2seg show");

	# Split segments longer than 20s (useful for transcription)
	my $splseg="$workdir/show.spl.seg";

	cmd("$lium_cmd fr.lium.spkDiarization.tools.SSplitSeg " .
		"--sFilterMask=$pmsseg --sFilterClusterName=iS,iT,j --sInputMask=$flt2seg  --sSegMaxLen=2000 --sSegMaxLenModel=2000 " .
		"--sOutputMask=$splseg --fInputMask=$features --fInputDesc=audio2sphinx,1:3:2:0:0:0,13,0:0:0 --tInputMask=$sgmm show");

	# Set gender and bandwidth
	my $gseg = "$workdir/show.g.seg";

	cmd("$lium_cmd fr.lium.spkDiarization.programs.MScore " .
		"--sGender --sByCluster --fInputDesc=audio2sphinx,1:3:2:0:0:0,13,1:1:0 --fInputMask=$features --sInputMask=$splseg " .
		"--sOutputMask=$gseg --tInputMask=$ggmm show");

	# NCLR clustering
	# Features contain static and delta and are centered and reduced (--fInputDesc)
	cmd("$lium_cmd fr.lium.spkDiarization.programs.MClust " .
		"--fInputMask=$features --fInputDesc=audio2sphinx,1:3:2:0:0:0,13,1:1:300:4 --sInputMask=$gseg " .
		"--sOutputMask=$workdir/show.seg --cMethod=ce --cThr=1.7 --tInputMask=$ubm " .
		"--emCtrl=1,5,0.01 --sTop=5,$ubm --tOutputMask=$workdir/show.c.gmm show");

	open SEGMENTS, "<$workdir/show.seg";

	while (my $str = <SEGMENTS>) {
		chomp($str);

		my ($start, $duration, $speaker) = (split(' ', $str))[2, 3, 7];
		my ($s, $d) = map { $_ / 100.0 } ($start, $duration);
		my $filename = "$features.${start}_${duration}_${speaker}.wav";

		cmd("sox $features $filename trim $s $d");

		database->quick_insert('files', {
											'data'			=> database->pg_lo_import($filename),
											'properties'	=> '{"content_type":"audio/x-wav"}',
										}
		);

		database->quick_insert('utterancies', {
											'recording'	=> $id,
											'start'		=> $start,
											'duration'	=> $duration,
											'speaker'	=> $speaker,
											'datafile'	=> database->last_insert_id(undef, undef, 'files', undef)
											}
		);
	}

	close SEGMENTS;

	rmtree($workdir);
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

