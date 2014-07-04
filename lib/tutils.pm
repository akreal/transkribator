package tutils;

use strict;
use warnings;

use Capture::Tiny 'capture_stderr';
use Carp;
use File::Slurp;
use File::Temp 'tempdir';

my $kaldi_root = $ENV{'KALDIROOT'};
$ENV{'PATH'} = "$kaldi_root/src/bin:$kaldi_root/src/fstbin/:$kaldi_root/src/gmmbin/:$kaldi_root/src/featbin/:$kaldi_root/src/lm/:$kaldi_root/src/sgmmbin/:$kaldi_root/src/sgmm2bin/:$kaldi_root/src/fgmmbin/:$kaldi_root/src/latbin/:$ENV{'PATH'}";

my $model = $ENV{'KALDIMODEL'};
my $beam = 10.0;
my $acoustic_scale = 0.083;
my $lattice_beam = 6.0;

sub convert {
	my ($in, $out) = @_;
	cmd("sox \"$in\" -r16k \"$out\"");
}

sub transkript {
	my $file = shift;

	my $tmpdir = tempdir(CLEANUP => 1);

	write_file("$tmpdir/wav.scp", "utt $file\n");
	write_file("$tmpdir/utt2spk", "utt anonymous\n");
	write_file("$tmpdir/spk2utt", "anonymous utt\n");

	cmd("compute-mfcc-feats  --verbose=2 --use-energy=false scp:$tmpdir/wav.scp ark:- | ".
		"copy-feats --compress=false ark:- ark,scp:$tmpdir/feats.ark,$tmpdir/feats.scp");
	cmd("compute-cmvn-stats --spk2utt=ark:$tmpdir/spk2utt scp:$tmpdir/feats.scp ark,scp:$tmpdir/cmvn.ark,$tmpdir/cmvn.scp");
	cmd("gmm-latgen-faster --allow-partial=true --beam=$beam --acoustic-scale=$acoustic_scale --max-arcs=-1 ".
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
		"--max-arcs=-1 --determinize-lattice=false --allow-partial=true  $model/final.mdl $model/HCLG.fst ".
		"\"ark,s,cs:apply-cmvn --norm-vars=false --utt2spk=ark:$tmpdir/utt2spk scp:$tmpdir/cmvn.scp ".
		"scp:$tmpdir/feats.scp ark:- | splice-feats  ark:- ark:- | transform-feats $model/final.mat ark:- ark:- | ".
		"transform-feats --utt2spk=ark:$tmpdir/utt2spk ark:$tmpdir/pre_trans ark:- ark:- |\" ".
		"\"ark:|gzip -c > $tmpdir/lat.tmp.gz\" ark,t:$tmpdir/tra.tra ark:- | ".
		"ali-to-phones --write-lengths=true $model/final.mdl ark:- ark,t:$tmpdir/utt.tra");

	return [ map { [ map {$_ + 0} split(' ', $_)  ] } split(' ; ', substr(read_file("$tmpdir/utt.tra"), 4)) ];
}

sub cmd {
	my $cmd = shift;
	my ($stderr, $exit) = capture_stderr { system('/bin/bash', '-c', $cmd) };
	croak "Non-zero status $exit for\n$cmd\n$stderr\n" if $exit != 0;
}

1;
