#!/bin/bash
# LanceDB Test Runner for Docker (Linux/Mac)

echo "=== LanceDB Docker Test Runner ==="

# Step 1: Pull Ollama model
echo "\n[1] Pulling Ollama embedding model..."
ollama pull nomic-embed-text

# Step 2: Build Docker image
echo "\n[2] Building Docker image..."
docker build -t agents-mem-test .

# Step 3: Run LanceDB tests
echo "\n[3] Running LanceDB tests in Docker..."
docker run --rm \
    -e OLLAMA_URL=http://host.docker.internal:11434 \
    --add-host=host.docker.internal:host-gateway \
    -v $(pwd)/src:/app/src \
    -v $(pwd)/tests:/app/tests \
    -v $(pwd)/package.json:/app/package.json \
    agents-mem-test bun test tests/lance

echo "\n=== Done ==="