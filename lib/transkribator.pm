package transkribator;

use strict;
use warnings;

use Dancer2;
use Dancer2::Plugin::Database;
use Authen::Passphrase::BlowfishCrypt;
use Data::UUID;
use File::Slurp;
use File::MMagic;
use Gearman::XS qw(:constants);
use Gearman::XS::Client;
use List::MoreUtils qw(uniq);

our $VERSION = '0.1';

get '/' => sub {
	my $zone = session('username') ? 'my' : 'shared';
	forward("/transcriptions/list/$zone");
};

get '/signup' => sub {
	template 'signup' => { title => 'Sign up' }, { layout => 'largeform' };
};

post '/signup' => sub {
	my $username = param('username');
	my $email = param('email');
	my $password = param('password');

	$username =~ s/^\s*//;
	$username =~ s/\s*$//;
	$password =~ s/^\s*//;
	$password =~ s/\s*$//;

	if (database->quick_count('users', {'username' => $username})) {
		return template 'signup' => {
			title	=> 'Sign up',
			warn	=> "Username '$username' is already taken"
		}, { layout => 'largeform' };
	}
	elsif (database->quick_count('users', 'lower(email) = ' . database->quote(lc($email)))) {
		return template 'signup' => {
			title	=> 'Sign up',
			warn	=> "Email '$email' is already used"
		}, { layout => 'largeform' };
	}

	my $ppr = Authen::Passphrase::BlowfishCrypt->new('cost' => 10, 'salt_random' => 1, 'passphrase' => $password);

	database->quick_insert('users', {'username' => $username, 'email' => $email, 'password' => $ppr->as_crypt});

	my $userid = database->quick_lookup('users', {'username' => $username }, 'id');

	session username => $username;
	session userid => $userid;

	redirect '/';
};

get '/login' => sub {
	if (session('username')) {
		redirect '/';
	}
	else {
		template 'login'=> { 'title' => 'Log in'}, { 'layout' => 'largeform' };
	}
};

post '/login' => sub {
	my $username = param( 'username');

	$username =~ s/^\s*//;
	$username =~ s/\s*$//;

	my ($ppr, $properties);

	my $row = database->quick_select('users', { 'username' => $username }, ['username', 'password', 'id', 'properties']);
	$row ||= database->quick_select('users', 'lower(email) = ' . database->quote(lc($username)), ['username', 'password', 'id', 'properties']);

	if ($row) {
		$username = $row->{'username'};
		$ppr = Authen::Passphrase::BlowfishCrypt->from_crypt($row->{'password'});
		$properties = from_json($row->{'properties'});
	}

	if ($ppr && $ppr->match(param('password'))) {
		session username => $username;
		session userid => $row->{'id'};
		session admin => 1 if $properties->{'admin'} == 1;
		#session->expires(86400); # TODO: check what happens in browser
		redirect '/';
	}
	else {
		return template 'login' => {
			'title'	=> 'Log in',
			'warn'	=> 'Wrong username or password'
		}, { 'layout' => 'largeform' };
	}
};

get '/logout' => sub {
	app->destroy_session;
	return template 'logout' => { 'title' => 'Log out' };
};

get '/about' => sub {
	session();
	return template 'about' => { 'title' => 'About' };
};

get '/faq' => sub {
	session();
	return template 'faq' => { 'title' => 'FAQ' };
};

get '/settings' => sub {
	session();
	return template 'settings' => { 'title' => 'Settings' };
};

get '/profile' => sub {
	my $username = session('username');

	if (! $username) {
		return template 'needlogin' => { 'title' => 'Profile' };
	}

	my $row = database->quick_select('users', { 'username' => $username }, ['email', 'properties']);

	my $profile = from_json($row->{'properties'});
	$profile->{'username'} = $username;
	$profile->{'email'} = $row->{'email'};

	return template 'profile' => { 'title' => 'Profile', 'profile' => $profile };
};

post '/profile' => sub {
	my $username = session('username');

	if (! $username) {
		return template 'needlogin' => { title => 'Profile' };
	}

	my $profile = params();
	my $email = $profile->{'email'};

	my $properties = { %$profile };
	delete $properties->{'email'};

	database->quick_update('users', { 'username' => $username }, { 'email' => $email, 'properties' => to_json($properties) });

	$profile->{'username'} = $username;

	return template 'profile' => { title => 'Profile', profile => $profile, 'success' => 'Changes are saved' };
};

get '/password' => sub {
	my $username = session('username');

	if (! $username) {
		return template 'needlogin' => { title => 'Password' };
	}

	return template 'password' => { title => 'Password' };
};

post '/password' => sub {
	my $username = session('username');

	if (! $username) {
		return template 'needlogin' => { title => 'Password' };
	}

	my $oldpassword = param('oldpassword');
	my $newpassword = param('newpassword');
	my $newpassword_ = param('newpassword_');

	my $ppr = Authen::Passphrase::BlowfishCrypt->from_crypt(database->quick_lookup('users', { 'username' => $username }, 'password'));

	if (! $ppr->match($oldpassword)) {
		return template 'password' => { title => 'Password', warn => 'Old password is incorrect' };
	}

	if ($newpassword ne $newpassword_) {
		return template 'password' => { title => 'Password', warn => 'New passwords don\'t match' };
	}

	$ppr = Authen::Passphrase::BlowfishCrypt->new('cost' => 10, 'salt_random' => 1, 'passphrase' => $newpassword);
	database->quick_update('users', { 'username' => $username }, { 'password' => $ppr->as_crypt });

	return template 'password' => { 'title' => 'Password', 'success' => 'Password is updated' };
};

get '/transcriptions/list/:zone' => sub {
	my $zone = param('zone');
	my $username = session('username');

	if ($zone ne 'my' && $zone ne 'shared') {
		redirect '/';
	}

	if ($zone eq 'my' && !$username) {
		return template 'needlogin' => { title => 'Transcriptions' };
	}

	my @transcriptions = database->quick_select(
							'recordings',
							( $zone eq 'my' ? { 'owner' => session 'userid' } : { 'shared' => 'true' } ),
							{ columns => ['id', 'title', 'filename', 'description', 'updated'], order_by => { desc => 'updated' } }
							);

	return template 'transcriptions' => { title => ucfirst("$zone transcriptions"), zone => $zone, transcriptions => \@transcriptions };
};

get '/transcriptions/new' => sub {
	my $username = session('username');

	if (!$username) {
		return template 'needlogin' => { title => 'New transcription' };
	}

	return template 'newtranscription' => { title => 'New transcription' };
};

post '/transcriptions/update' => sub {
	my $userid = session('userid');

	if (!$userid) {
		return template 'needlogin' => { title => 'Transcription' };
	}

	my ($id, $title, $description, $transkriptions) = map { param($_) eq '' ? undef : param($_) } ('id', 'title', 'description', 'transkriptions');
	
	my $owner = database->quick_lookup('recordings', { 'id' => $id }, 'owner');

	if (session('userid') ne $owner) {
		send_error('You are not allowed to edit this transcription', 403);
	}

	database->quick_update('recordings', { 'id' => $id }, { 'title' => $title, 'description' => $description, 'updated' => 'now()', shared => param('shared') || 'f' });

	my $t = eval { from_json($transkriptions) };
	if (ref $t eq 'ARRAY') {
		foreach my $segment (0 .. $#$t) {
			if (ref $t->[$segment] eq 'ARRAY') {
				database->quick_insert('transcriptions',
					{ 'utterance' => $segment, 'author' => $owner, 'transcription' => $t->[$segment] });
			}
		}
	}
	
	redirect("/transcriptions/$id");
};

get '/transcriptions/:id' => sub {
	session();

	my $id = param('id');
	my $transcription = database->quick_select('recordings', { 'id' => $id }, ['id', 'filename', 'title', 'description', 'shared', 'owner', 'created', 'updated', 'properties', 'datafile']);

	if (! $transcription) {
		send_error('This transcription doesn\'t exist', 404);
	}
	if ($transcription->{'shared'} != 1 && (! session('username') || session('userid') ne $transcription->{'owner'})) {
		send_error('You are not allowed to view this transcription', 403);
	}

	my $type = param('type') || '';
	my $segment = param('segment');

	if ($type eq 'audio') {
		return serve_file(
				database->quick_lookup('utterancies', {'id' => $segment, 'recording' => $id }, 'hdatafile'),
				"${id}-${segment}.m4a"
		);
	}
	elsif ($type eq 'segments') {
		my @segments = database->quick_select('utterancies', { 'recording' => $id }, {
											'columns'	=> [ 'id', 'start', 'duration', 'speaker' ],
											'order_by'	=> { 'asc' => 'start' }
		});

		if (! @segments) {
			send_error('This transcription doesn\'t exist', 404);
		}

		return to_json(\@segments);
	}
	elsif ($type eq 'transkription') {
		if ($segment) {
			my $transkription = database->quick_select('transcriptions', { 'utterance' => $segment }, {
												'columns'	=> [ 'transcription' ],
												'order_by'	=> { 'desc' => 'created' }
			});

			if (! $transkription) {
				send_error('This transcription doesn\'t exist', 404);
			}

			return to_json($transkription->{'transcription'});
		}
	}
	elsif ($type eq 'file') {
		return serve_file($transcription->{'datafile'}, $transcription->{'filename'});
	}
	elsif ($type eq 'progress') {
		my @segments = database->quick_select('utterancies', { 'recording' => $id }, { 'columns' => [ 'id' ] });
		my $percent = scalar(@segments);

		if ($percent > 0) {
			my @transcriptions = database->quick_select('transcriptions',
				{ 'utterance' => [ map { $_->{'id'} } @segments ] }, { 'columns' => [ 'utterance' ] });
			$percent = 100 * scalar(uniq(map { $_->{'utterance'} } @transcriptions)) / $percent;
		}

		return to_json({ 'percent' => $percent });
	}
	elsif ($type eq 'properties') {
		return $transcription->{'properties'};
	}

	my $editable = session('username') && session('userid') eq $transcription->{'owner'};

	if ($segment) {
		return template
			'utterance' => { 'title' => 'Utterance', 'recording' => $id, 'segment' => $segment, 'editable' => $editable },
			{ layout => 'utterance' };
	}
	else {
		return template
			'transcription' => { 'title' => 'Transcription', 'transcription' => $transcription, 'editable' => $editable };
	}
};

post '/utterance/upload' => sub {
	my $username = session('username');

	if (! $username) {
		return to_json({ 'id' => undef, 'error' => 'You need to be logged in' });
	}

	my $id = lc(Data::UUID->new->create_str);

	my $owner = session('userid');
	my $upload = upload('file');
	my $filename = $upload->filename;
	my $tempname = $upload->tempname;

	my $gearman = Gearman::XS::Client->new;
	my $ret = $gearman->add_server( @{config->{'plugins'}->{'GearmanXS'}}{'host', 'port'} );
	if ($ret != GEARMAN_SUCCESS) {
		send_error('Can not accept the upload', 500);
	}

	database->quick_insert('files', {
									'data'		=> database->pg_lo_import($tempname),
									'properties'=> to_json({ 'content_type' => File::MMagic->new->checktype_filename($tempname) }),
								}
	);

	database->quick_insert('recordings', {
											'id'		=> $id,
											'owner'		=> $owner,
											'filename'	=> $filename,
											'datafile'	=> database->last_insert_id(undef, undef, 'files', undef),
											}
	);

	$gearman->do_background('segmentate', $id);

	return to_json({ 'id' => $id, 'filename' => $filename });
};

get '/admin' => sub {
	if (! session('admin')) {
		send_error('This page does not exist', 404);
	}

	return template 'admin' => { 'title' => 'Admin' };
};

any '/phones' => sub {
	if (! session('admin')) {
		send_error('This page does not exist', 404);
	}

	my $phones = param('phones');

	if ($phones && from_json($phones)) {
		write_file(config->{appdir} . '/public/javascripts/phones.js', 'var phones=' . $phones . ';function _f(list,id){for(var i=0;i<list.length;i++){if(list[i].id==id){return i;}}}');
	}

	return template 'phones' => { 'title' => 'Phones' };
};

sub serve_file {
	my ($id, $filename) = @_;

	my $file = database->quick_select('files', { 'id' => ($id || 0) }, ['data', 'properties']);

	if (! $file) {
		send_error('This file does not exist', 404);
	}

	my $loid = $file->{'data'};
	my $properties = from_json($file->{'properties'});

	return delayed {
		header 'Content-Type' => $properties->{'content_type'};
		header 'Content-Disposition' => "attachment; filename=\"$filename\"";

		flush;

		database->{'AutoCommit'} = 0;

		my $buffer = '';
		my $fd = database->pg_lo_open($loid, database->{'pg_INV_READ'});

		while (database->pg_lo_read($fd, $buffer, 1024)) {
			content $buffer;
		}

		done;

		database->{'AutoCommit'} = 1;
	};
}

dance;
