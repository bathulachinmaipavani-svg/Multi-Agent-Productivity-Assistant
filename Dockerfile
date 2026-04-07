# Use slim image for smaller size
FROM node:18-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy project files
COPY . .

# Cloud Run defaults to PORT 8080
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
