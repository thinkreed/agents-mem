FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/
COPY tests/ tests/
COPY DESIGN.md IMPLEMENTATION_PLAN.md ./

# Set environment
ENV NODE_ENV=test
ENV OLLAMA_URL=http://host.docker.internal:11434

# Run tests
CMD ["bun", "test"]