Here is the web front-end of Transkribator.
How to set it up in Gentoo (some details may be missing):

```bash
layman -a perl-experimental
emerge Dancer2 CGI-Deurl-XS JSON-XS Scope-Upper URL-Encode-XS Dancer2-Session-Cookie Dancer2-Plugin-Database Data-UUID File-Slurp Authen-Passphrase File-MMagic File-Temp perl-Carp uwsgi sudo nginx git postgresql DBD-Pg
/etc/init.d/postgresql-9.3 start
rc-update add postgresql-9.3 default
sudo -u postgres psql -c 'CREATE USER transkribator CREATEDB;'
psql -h localhost -U transkribator postgresql -c 'CREATE DATABASE transkribator;'
mkdir /var/www/transkribator.com
cd /var/www/transkribator.com
sudo -u nginx git clone https://github.com/karese/transkribator.git
psql -h localhost -U transkribator < /var/www/transkribator.com/transkribator/transkribator.sql
cd /etc/conf.d
cp -a uwsgi uwsgi.transkribator
# Change:
# UWSGI_DIR=/var/www/transkribator.com/transkribator
# UWSGI_USER=nginx
# UWSGI_GROUP=nginx
# UWSGI_EXTRA_OPTIONS="--plugins psgi --psgi bin/app.pl --socket 127.0.0.1:3031 --env DANCER_ENVIRONMENT=production --env KALDIROOT=/opt/transkribator/kaldi --env KALDIMODEL=/opt/transkribator/model --processes 4 --harakiri 30 --master --buffer-size 65536"
cd /etc/init.d
ln -s uwsgi uwsgi.transkribator
/etc/init.d/uwsgi.transkribator start
rc-update add uwsgi.transkribator default
/etc/init.d/nginx start
rc-update add nginx default
```
NGINX configuration snippet:
```nginx
	uwsgi_buffering off;

    server {
        listen *;
        server_name transkribator.com www.transkribator.com;

        location / {
            rewrite ^ https://transkribator.com$request_uri permanent;
        }
    }

    server {
        listen *:443 ssl spdy;
        server_name www.transkribator.com;

        ssl on;
        ssl_certificate /etc/ssl/nginx/transkribator.com.crt;
        ssl_certificate_key /etc/ssl/nginx/transkribator.com.key;

        access_log /var/log/nginx/transkribator.com.access_log main;
        error_log /var/log/nginx/transkribator.com.error_log info;

        location / {
            include uwsgi_params;
            uwsgi_pass 127.0.0.1:3031;
            uwsgi_modifier1 5;
        }
 
        location ~ \/(bootstrap|css|favicon.ico|fontawesome|javascripts|build) { 
            root /var/www/transkribator.com/transkribator/public;
        }

    }
```
