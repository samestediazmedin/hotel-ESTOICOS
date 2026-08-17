# Use a Node.js base image
FROM node:20-alpine AS development

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

# Build the API application
# This assumes that the 'api' workspace has a 'build' script
# and that 'prisma generate' is either part of the build or handled separately
FROM development AS build

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Install dependencies for the API application specifically
ENV CI=true
RUN pnpm --filter @hotel/api install

# Build the NestJS application
RUN pnpm --filter @hotel/api build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy pnpm-lock.yaml and package.json from the development stage
COPY --from=development /app/pnpm-lock.yaml ./
COPY --from=development /app/package.json ./

# Install pnpm
RUN npm install -g pnpm

# Install jq for JSON manipulation
RUN apk add --no-cache jq

# Remove the "prepare" script from package.json before installing production dependencies
RUN jq 'del(.scripts.prepare)' package.json > package.json.tmp && mv package.json.tmp package.json

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from the build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Copy the entire node_modules from the development stage and prune for production
COPY --from=development /app/node_modules ./node_modules
ENV CI=true
RUN pnpm prune --prod

# Copy necessary files for Prisma at runtime
# This might need adjustment based on how Prisma is bundled/accessed
# COPY --from=build /app/node_modules/.prisma/client ./node_modules/.prisma/client
# COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Expose the port the application runs on
EXPOSE 3000

# Command to run the application
# Assumes the start:prod script handles prisma migrate deploy
CMD ["pnpm", "--filter", "@hotel/api", "start:prod"]
