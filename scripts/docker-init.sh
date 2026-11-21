#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker info >/dev/null
if [ ! -s .docker/secrets/db_admin_password.txt ] || [ ! -s .docker/secrets/db_app_password.txt ]; then
  if docker volume inspect villa-horizonte_postgres_data >/dev/null 2>&1; then
    echo 'Existe una base Docker pero faltan credenciales. Recupera .docker/secrets.' >&2
    exit 1
  fi
  mkdir -p .docker/secrets
  umask 077
  for name in db_admin_password db_app_password; do
    if [ ! -s ".docker/secrets/$name.txt" ]; then
      od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > ".docker/secrets/$name.txt"
    fi
  done
fi
set -- -f compose.yaml
if [ -f .docker/compose.local.yaml ]; then set -- "$@" -f .docker/compose.local.yaml; fi
docker compose "$@" config --quiet
docker compose "$@" up --build --wait --wait-timeout 240
