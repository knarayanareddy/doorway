#!/bin/zsh
# Run the generated WordPress plugin inside a real WordPress (SQLite, no MySQL) and drive it
# with the Playwright suite in all three browsers. Needs php and curl; downloads WordPress
# and the SQLite integration plugin on first use. Nothing leaves this machine except those downloads.
#
#   scripts/wp-verify.sh            (from the repo root)
set -eu
ROOT=${0:A:h:h}
WP_DIR=${WP_DIR:-${TMPDIR:-/tmp}/doorway-wp}
PORT=8790
mkdir -p "$WP_DIR" && cd "$WP_DIR"
[ -d wordpress ] || curl -sL https://wordpress.org/latest.tar.gz | tar xz
[ -d wordpress/wp-content/plugins/sqlite-database-integration ] || {
  curl -sL -o sq.zip https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
  unzip -q sq.zip -d wordpress/wp-content/plugins/; }
[ -f wp-cli.phar ] || curl -sL -o wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
wp() { php -d error_reporting=24575 -d display_errors=0 "$WP_DIR/wp-cli.phar" --path="$WP_DIR/wordpress" "$@"; }

if [ ! -f wordpress/wp-config.php ]; then
  cp wordpress/wp-content/plugins/sqlite-database-integration/db.copy wordpress/wp-content/db.php
  sed -i.bak "s|{SQLITE_IMPLEMENTATION_FOLDER_PATH}|$WP_DIR/wordpress/wp-content/plugins/sqlite-database-integration|; s|{SQLITE_PLUGIN}|sqlite-database-integration/load.php|" wordpress/wp-content/db.php
  cp wordpress/wp-config-sample.php wordpress/wp-config.php
  wp core install --url=http://127.0.0.1:$PORT --title=Test --admin_user=admin --admin_password=pw --admin_email=a@b.test --skip-email
fi

# Build against a local "CDN" path served by the same PHP server.
cd "$ROOT"
DOOR_ORIGIN=http://127.0.0.1:8788 CDN_BASE=http://127.0.0.1:$PORT/doorway-cdn node scripts/build.mjs > /dev/null
php -l dist/wordpress/doorway/doorway.php
rm -rf "$WP_DIR/wordpress/wp-content/plugins/doorway" "$WP_DIR/wordpress/doorway-cdn"
cp -r dist/wordpress/doorway "$WP_DIR/wordpress/wp-content/plugins/doorway"
mkdir -p "$WP_DIR/wordpress/doorway-cdn/v0.2.0" && cp dist/v0.2.0/doorway.min.js "$WP_DIR/wordpress/doorway-cdn/v0.2.0/"
wp plugin activate doorway
wp option update doorway_install inst_wp0001
wp option update doorway_country NL

php -d error_reporting=24575 -d display_errors=0 -S 127.0.0.1:$PORT -t "$WP_DIR/wordpress" > /dev/null 2>&1 &
PHP_PID=$!
trap 'kill $PHP_PID 2>/dev/null' EXIT
sleep 2
WP_URL=http://127.0.0.1:$PORT/ npx playwright test wordpress
