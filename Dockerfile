# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY web/ ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install a simple HTTP server
RUN npm install -g serve

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]
