#!/bin/sh
set -eu
# Sourced by the official image. No connection to the host's PostgreSQL.
set -- --file=/opt/villa/schema-install.sql
if [ "${VILLA_SEED_DEMO:-0}" = "1" ]; then
  test -r /opt/villa/seed-demo.sql || { echo 'No se encontro el archivo local de datos.' >&2; exit 1; }
  set -- "$@" --file=/opt/villa/seed-demo.sql
fi
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=app_password="$(cat /run/secrets/db_app_password)" \
  --single-transaction \
  "$@" \
  --file=/opt/villa/routines-install.sql \
  --file=/opt/villa/permissions.sql
