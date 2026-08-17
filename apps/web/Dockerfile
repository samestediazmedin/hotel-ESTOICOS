# Use a Node.js base image for building the frontend
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy pnpm-lock.yaml and package.json files for efficient caching
COPY pnpm-lock.yaml ./
COPY package.json ./

# Install pnpm
RUN npm install -g pnpm

# Install root dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo files
COPY . .

# Install dependencies for the web application specifically
ENV CI=true
RUN pnpm --filter @hotel/web install

# Build the web application
# This assumes that the 'web' workspace has a 'build' script
RUN pnpm --filter @hotel/web build

# Production stage: serve static files with a lightweight web server
FROM node:20-alpine AS production

WORKDIR /app

# Copy pnpm-lock.yaml and package.json from the build stage
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/package.json ./

# Install pnpm
RUN npm install -g pnpm

# Install jq for JSON manipulation
RUN apk add --no-cache jq

# Remove the "prepare" script from package.json before installing production dependencies
RUN jq 'del(.scripts.prepare)' package.json > package.json.tmp && mv package.json.tmp package.json

# Install only production dependencies (if any are needed for the static server)
# For a simple static server, usually no production dependencies are needed beyond the server itself
RUN pnpm install --prod --frozen-lockfile

# Copy the built static assets from the build stage
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Expose the port the static server will run on
EXPOSE 4173

# Command to serve the static files
# We'll use 'serve' or a simple http-server if available, or a custom node script
# For now, let's assume 'vite preview' or a similar command is used, or a simple static server
# If 'vite preview' is not suitable for production, a dedicated static server like 'serve' or 'nginx' should be used.
# For simplicity, let's use the 'start' script defined in apps/web/package.json which uses 'vite preview'
CMD ["pnpm", "--filter", "@hotel/web", "start"]
