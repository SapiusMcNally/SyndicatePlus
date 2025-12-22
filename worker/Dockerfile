FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema
COPY prisma ./prisma/

# Install dependencies (skip postinstall since we'll run prisma generate after)
RUN npm install --ignore-scripts

# Generate Prisma client with correct binary target
RUN npx prisma generate

# Copy application code
COPY . .

# Expose port
EXPOSE 4000

# Start the application
CMD ["node", "server.js"]
