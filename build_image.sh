#! /usr/bin/env bash

set -eux

# docker build -t sconaway/musa:amd64-latest .
# docker build -t sconaway/musa:arm64-latest -f Dockerfile.arm64 .

docker buildx build --platform linux/amd64 --push --tag sconaway/musa:amd64-latest .
docker buildx build --platform linux/arm64 --push --tag sconaway/musa:arm64-latest -f Dockerfile.arm64 .

docker manifest create sconaway/musa:latest sconaway/musa:amd64-latest sconaway/musa:arm64-latest

docker manifest annotate --arch amd64 sconaway/musa:latest sconaway/musa:amd64-latest
docker manifest annotate --arch arm64 sconaway/musa:latest sconaway/musa:arm64-latest

docker manifest push sconaway/musa
