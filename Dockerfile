FROM node:20-slim

# Install system dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxshmfence1 \
    libglu1-mesa \
    libpango-1.0-0 \
    libcairo2 \
    openssl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files AND prisma schema (needed by postinstall: prisma generate)
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install dependencies (postinstall runs prisma generate)
RUN npm ci

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy rest of the app
COPY . .

# Build Next.js
RUN npm run build

# Create uploads directory for resume files
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
