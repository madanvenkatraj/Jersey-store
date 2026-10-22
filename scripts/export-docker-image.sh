#!/bin/sh
set -eu

IMAGE_NAME="matchday-world-cup-jersey-store:1.0.0"
OUTPUT_FILE="matchday-world-cup-jersey-store-image.tar"

command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install Docker Desktop or Docker Engine first." >&2; exit 1; }
docker build -t "$IMAGE_NAME" .
docker save -o "$OUTPUT_FILE" "$IMAGE_NAME"
echo "Docker image exported to: $OUTPUT_FILE"
echo "Load it on another machine with: docker load -i $OUTPUT_FILE"
