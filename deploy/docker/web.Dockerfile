FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*
COPY deploy/docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/docker/php.ini /usr/local/etc/php/conf.d/villa.ini
WORKDIR /var/www/app
COPY frontend/index.html frontend/conexion.html ./frontend/
COPY frontend/css/ ./frontend/css/
COPY frontend/js/app.js frontend/js/connection.js ./frontend/js/
COPY frontend/js/components/ ./frontend/js/components/
COPY frontend/js/lib/ ./frontend/js/lib/
COPY frontend/js/views/ ./frontend/js/views/
COPY frontend/js/services/domain.js frontend/js/services/reports.js frontend/js/services/repository.js ./frontend/js/services/
COPY backend/ ./backend/
EXPOSE 80
