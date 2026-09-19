#!/usr/bin/env sh
set -eu
ENV_FILE="${ENV_FILE:-.env.production}"
if [ -z "${LETSENCRYPT_EMAIL:-}" ] && [ -f "$ENV_FILE" ]; then
  LETSENCRYPT_EMAIL="$(sed -n 's/^LETSENCRYPT_EMAIL=//p' "$ENV_FILE" | tail -n 1)"
fi
if [ -z "${PORTAL_DOMAINS:-}" ] && [ -f "$ENV_FILE" ]; then
  PORTAL_DOMAINS="$(sed -n 's/^PORTAL_DOMAINS=//p' "$ENV_FILE" | tail -n 1)"
fi
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required in the environment or .env.production}"
: "${PORTAL_DOMAINS:?PORTAL_DOMAINS is required in the environment or .env.production}"
set -- $PORTAL_DOMAINS
CERT_ARGS=""
for domain in "$@"; do CERT_ARGS="$CERT_ARGS -d $domain"; done
# Free host port 80 for Certbot's standalone challenge. Nginx is started again after issuance.
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" stop nginx >/dev/null 2>&1 || true
cleanup() {
  docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d nginx >/dev/null 2>&1 || true
}
trap cleanup EXIT
# shellcheck disable=SC2086
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" run --rm certbot certonly --standalone $CERT_ARGS --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email
