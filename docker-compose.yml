# Base image with PHP, Apache, and Node.js
FROM php:8.2-apache

# Install PHP extensions (e.g., mysqli)
RUN docker-php-ext-install mysqli

# Install Node.js and npm
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm

# Copy PHP files to Apache root
COPY Public/ /var/www/html/
COPY Server/Authentication.php /var/www/html/api/Authentication.php

# Install Node.js server dependencies
COPY package.json /app/package.json
COPY Server/server.js /app/server.js
WORKDIR /app
RUN npm install

# Expose PHP port (Apache on port 80) and Node.js port (3000)
EXPOSE 80 3000

# Start both PHP and Node servers
CMD service apache2 start && node server.js
