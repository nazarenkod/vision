#!/bin/sh
# (c) https://github.com/kunokdev/cra-runtime-environment-variables/blob/master/env.sh
# line endings must be \n, not \r\n !
#
# Writes env-config.js from the settings named in env.defaults: each from the environment when
# set, else its default. A local .env, when there is one, takes the place of env.defaults.
DEFAULTS=./env.defaults
[ -f ./.env ] && DEFAULTS=./.env

echo "window._env_ = {" > ./env-config.js
awk -F '=' '{ print $1 ": \"" (ENVIRON[$1] ? ENVIRON[$1] : $2) "\"," }' "$DEFAULTS" >> ./env-config.js
echo "}" >> ./env-config.js
