#!/usr/bin/env bash
# ==============================================================================
# ReelMind — Automated Let's Encrypt Free SSL Setup Script
# Usage: ./deploy/setup-ssl.sh yourdomain.com admin@yourdomain.com
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo -e "${RED}Usage: $0 <your-domain.com> <your-email@example.com>${NC}"
  echo -e "Example: $0 reelmind.mydomain.com user@mydomain.com"
  exit 1
fi

echo -e "${BOLD}Configuring SSL for domain: ${GREEN}$DOMAIN${NC} with contact ${GREEN}$EMAIL${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Ensure directories exist
mkdir -p certbot/conf certbot/www

# 1. Obtain Let's Encrypt Certificate via ACME webroot challenge
echo -e "\n${BOLD}[1/4] Requesting SSL Certificate from Let's Encrypt...${NC}"
docker run --rm \
  -v "$ROOT_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$ROOT_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

if [ ! -d "$ROOT_DIR/certbot/conf/live/$DOMAIN" ]; then
  echo -e "${RED}Error: Certificate generation failed.${NC}"
  echo "Please verify that your DNS A record for $DOMAIN points to this server's public IP address."
  exit 1
fi

# 2. Generate customized Nginx SSL configuration
echo -e "\n${BOLD}[2/4] Generating Nginx SSL configuration...${NC}"
sed "s/YOUR_DOMAIN_HERE/$DOMAIN/g" "$ROOT_DIR/client/nginx.ssl.conf" > "$ROOT_DIR/client/nginx.conf.active"

# 3. Update .env.production CLIENT_URL to HTTPS
echo -e "\n${BOLD}[3/4] Updating CLIENT_URL in .env.production to https://$DOMAIN...${NC}"
if grep -q "CLIENT_URL=" .env.production; then
  sed -i.bak "s|^CLIENT_URL=.*|CLIENT_URL=https://$DOMAIN|" .env.production
  rm -f .env.production.bak
else
  echo "CLIENT_URL=https://$DOMAIN" >> .env.production
fi

# 4. Apply configuration to running client container
echo -e "\n${BOLD}[4/4] Reloading Nginx with SSL...${NC}"
docker cp "$ROOT_DIR/client/nginx.conf.active" reelmind-client:/etc/nginx/conf.d/default.conf
docker exec reelmind-client nginx -s reload
docker compose -f docker-compose.prod.yml restart server

echo -e "\n${GREEN}${BOLD}✓ SSL certificate successfully installed!${NC}"
echo -e "Your ReelMind instance is now securely accessible via: ${BOLD}https://$DOMAIN${NC}"
