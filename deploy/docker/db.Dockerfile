FROM postgres:17-bookworm
COPY backend/schema.sql backend/routines.sql /opt/villa/
COPY deploy/docker/permissions.sql /opt/villa/permissions.sql
# Schema and routines run in one transaction. Production starts without rows.
RUN sed 's/\r$//; /^BEGIN;$/d; /^COMMIT;$/d' /opt/villa/schema.sql > /opt/villa/schema-install.sql \
    && sed 's/\r$//; /^BEGIN;$/d; /^COMMIT;$/d' /opt/villa/routines.sql > /opt/villa/routines-install.sql
COPY deploy/docker/initdb.sh /docker-entrypoint-initdb.d/10-villa.sh
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/10-villa.sh \
    && chmod 644 /docker-entrypoint-initdb.d/10-villa.sh
