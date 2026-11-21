#!/bin/sh
set -eu
# Sourced by the official image. No connection to the host's PostgreSQL.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=app_password="$(cat /run/secrets/db_app_password)" \
  --single-transaction \
  --file=/opt/villa/schema-install.sql \
  --file=/opt/villa/seed-demo.sql \
  --file=/opt/villa/routines-install.sql \
  --file=/opt/villa/permissions.sql
