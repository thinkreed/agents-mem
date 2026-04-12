# LanceDB Test Runner for Docker

Write-Host "=== LanceDB Docker Test Runner ===" -ForegroundColor Cyan

# Step 1: Pull Ollama model
Write-Host "`n[1] Pulling Ollama embedding model..." -ForegroundColor Yellow
ollama pull nomic-embed-text

# Step 2: Build Docker image with proxy
Write-Host "`n[2] Building Docker image..." -ForegroundColor Yellow
$proxy = "http://127.0.0.1:10809"
docker build --build-arg HTTP_PROXY=$proxy --build-arg HTTPS_PROXY=$proxy -t agents-mem-test .

# Step 3: Run LanceDB tests in Docker
Write-Host "`n[3] Running LanceDB tests in Docker..." -ForegroundColor Yellow
docker run --rm `
    -e OLLAMA_URL=http://host.docker.internal:11434 `
    -e HTTP_PROXY=http://host.docker.internal:10809 `
    -e HTTPS_PROXY=http://host.docker.internal:10809 `
    --add-host=host.docker.internal:host-gateway `
    -v ${PWD}/src:/app/src `
    -v ${PWD}/tests:/app/tests `
    -v ${PWD}/package.json:/app/package.json `
    agents-mem-test bun test tests/lance

Write-Host "`n=== Done ===" -ForegroundColor Green