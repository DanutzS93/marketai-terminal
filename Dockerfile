FROM node:22-slim

WORKDIR /app

# Copy package definitions
COPY package.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install --include=dev --legacy-peer-deps

# Copy application source files
COPY . .

# Build Vite frontend and bundle server
RUN npm run build

# Set production environment for runtime
ENV NODE_ENV=production
ENV PORT=8080

# Expose web & websocket port
EXPOSE 8080

# Start MarketAI production server
CMD ["node", "dist/server.cjs"]
