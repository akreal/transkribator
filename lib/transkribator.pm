package transkribator;

use strict;
use warnings;

use Dancer2;
use Dancer2::Plugin::Database;
use Authen::Passphrase::BlowfishCrypt;
use Data::UUID;
use File::Slurp;
use DBD::Pg;
use File::MMagic;
use tutils;

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
							'utterancies',
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

	my ($utt, $title, $description, $transkription) = map { param($_) eq '' ? undef : param($_) } ('utt', 'title', 'description', 'transkription');
	
	my $owner = database->quick_lookup('utterancies', { 'id' => $utt }, 'owner');

	if (session('userid') ne $owner) {
		send_error('You are not allowed to edit this transcription', 403);
	}

	database->quick_update('utterancies', { 'id' => $utt }, { 'title' => $title, 'description' => $description, 'updated' => 'now()', shared => param('shared') || 'f' });

	if ($transkription) {
		database->quick_insert('transcriptions', { 'utterance' => $utt, 'author' => $owner, 'transcription' => from_json($transkription) });
	}
	
	my $transcription = database->quick_select('utterancies', { 'id' => $utt }, ['id', 'filename', 'title', 'description', 'shared', 'owner', 'created', 'updated']);

	return template 'transcription' => { 'title' => 'Transcription', 'transcription' => $transcription, 'success' => 'Transcription is saved', 'editable' => 1};
};

get '/transcriptions/:utt' => sub {
	my $utt = param('utt');
	my $transcription = database->quick_select('utterancies', { 'id' => $utt }, ['id', 'filename', 'title', 'description', 'shared', 'owner', 'created', 'updated']);

	if (! $transcription) {
		send_error('This transcription doesn\'t exist', 404);
	}
	if ($transcription->{'shared'} != 1 && (! session('username') || session('userid') ne $transcription->{'owner'})) {
		send_error('You are not allowed to view this transcription', 403);
	}

	my $type = param('type') || '';

	if ($type eq 'audio') {
		my $audio = database->quick_lookup('utterancies', { 'id' => $utt }, 'cdata');
		return send_file(\$audio, 'content_type' => 'audio/x-wav', 'filename' => "$utt.wav");
	}
	elsif ($type eq 'json') {
		my $transkription = database->quick_select('transcriptions', { 'utterance' => $utt }, { columns => ['transcription'], 'order_by' => { desc => 'created' } });
		return to_json($transkription->{'transcription'});
	}
	elsif ($type eq 'file') {
		my $mm = File::MMagic->new;
		my $file = database->quick_lookup('utterancies', { 'id' => $utt }, 'data');
		return send_file(\$file, 'content_type' => $mm->checktype_contents($file), 'filename' => $transcription->{'filename'});
	}

	my $editable = session('username') && session('userid') eq $transcription->{'owner'};

	return template 'transcription' => { 'title' => 'Transcription', 'transcription' => $transcription, 'editable' => $editable };
};

post '/utterance/upload' => sub {
	my $username = session('username');

	if (! $username) {
		return to_json({ 'utt' => undef, 'error' => 'You need to be logged in' });
	}

	my $ug = Data::UUID->new;
	my $utt = $ug->create_str();

	my $file = upload('file');
	my $filename = $file->filename;
	my $data = $file->content;

	my $owner = session('userid');

	my $tempname = $file->tempname;
	tutils::convert($tempname, "$tempname.wav");
	my $cdata = read_file("$tempname.wav");

	my $sth = database->prepare('INSERT INTO utterancies(id, owner, filename, data, cdata) VALUES(?,?,?,?,?)');
	$sth->bind_param(4, undef, { pg_type => PG_BYTEA });
	$sth->bind_param(5, undef, { pg_type => PG_BYTEA });
	$sth->execute($utt, $owner, $filename, $data, $cdata);

	my $transcription = tutils::transkript("$tempname.wav");
	database->quick_insert('transcriptions', { 'utterance' => $utt, 'transcription' => $transcription });

	return to_json({ 'utt' => $utt, 'filename' => $filename });
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

dance;
