FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*
COPY deploy/docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/docker/php.ini /usr/local/etc/php/conf.d/villa.ini
WORKDIR /var/www/app
COPY frontend/ ./frontend/
COPY backend/ ./backend/
EXPOSE 80
