#!/usr/bin/env bash
# ==============================================================================
# ReelMind — One-Command Update & Rebuild Script
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}${BOLD}Updating ReelMind...${NC}"

# Pull latest Git changes
git pull

# Rebuild containers
docker compose -f docker-compose.prod.yml build

# Recreate updated containers with zero/minimal downtime
docker compose -f docker-compose.prod.yml up -d

# Prune unused build cache and dangling images
docker image prune -f

echo -e "${GREEN}${BOLD}✓ ReelMind successfully updated and running!${NC}"
