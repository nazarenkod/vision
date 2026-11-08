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

# The content security policy of the interface (052): scripts from Vision only, calls to its API
# only. The API's address is known only now, at start, so nginx includes the header from a file
# written here, from the policy in nginx/csp.template. VISION_CSP_FILE moves it, for the tests.
API_URL_NOW=$(awk -F '=' '$1 == "REACT_APP_API_URL" { print (ENVIRON[$1] ? ENVIRON[$1] : $2) }' "$DEFAULTS")
API_ORIGIN=$(printf '%s' "$API_URL_NOW" | sed -E 's#^(https?://[^/?#]+).*#\1#')
# an address on the interface's own host (relative, or none) is 'self' already
case "$API_ORIGIN" in http://*|https://*) ;; *) API_ORIGIN="" ;; esac
API_WS_ORIGIN=$(printf '%s' "$API_ORIGIN" | sed -E 's#^http#ws#')
CSP_TEMPLATE=./csp.template
[ -f "$CSP_TEMPLATE" ] || CSP_TEMPLATE=./nginx/csp.template
POLICY=$(sed -e "s#\${API_ORIGIN}#$API_ORIGIN#g" -e "s#\${API_WS_ORIGIN}#$API_WS_ORIGIN#g" "$CSP_TEMPLATE")
# without a policy nginx would send none and say nothing: better not to start
if [ -z "$POLICY" ]; then
  echo "env.sh: no content security policy from $CSP_TEMPLATE" >&2
  exit 1
fi
echo "add_header Content-Security-Policy \"$POLICY\" always;" > "${VISION_CSP_FILE:-/tmp/vision-csp.conf}"

