FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package definitions
COPY package.json ./

# Install dependencies required for build and runtime
RUN npm install --legacy-peer-deps

# Copy application source files
COPY . .

# Build Vite frontend and bundle server
RUN npm run build

# Expose web & websocket port
EXPOSE 8080

# Start MarketAI production server
CMD ["node", "dist/server.cjs"]
