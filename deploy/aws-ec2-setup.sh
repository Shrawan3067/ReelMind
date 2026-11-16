#!/usr/bin/env bash
# ==============================================================================
# ReelMind — Automated AWS EC2 Instance Setup & Deployment Script
# Supports: Amazon Linux 2023, Amazon Linux 2, Ubuntu 22.04/24.04 LTS, Debian
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}${BOLD}====================================================================${NC}"
echo -e "${BLUE}${BOLD}   ReelMind Autonomous AI Video Studio — AWS EC2 Setup Script       ${NC}"
echo -e "${BLUE}${BOLD}====================================================================${NC}"

# 1. System Requirements & Architecture Check
echo -e "\n${BOLD}[1/7] Checking system environment...${NC}"
if [ "$EUID" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

# Detect package manager
if command -v dnf &> /dev/null; then
  PKG_MGR="dnf"
elif command -v yum &> /dev/null; then
  PKG_MGR="yum"
elif command -v apt-get &> /dev/null; then
  PKG_MGR="apt"
else
  PKG_MGR="unknown"
fi
echo -e "Detected OS Package Manager: ${GREEN}${PKG_MGR}${NC}"

# Detect public IP
PUBLIC_IP=$(curl -s --connect-timeout 5 http://checkip.amazonaws.com || curl -s --connect-timeout 5 https://ifconfig.me || echo "127.0.0.1")
echo -e "Detected EC2 Public IP: ${GREEN}${PUBLIC_IP}${NC}"

# 2. Package Updates and Prerequisites
echo -e "\n${BOLD}[2/7] Installing prerequisites and Git...${NC}"
if [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
  $SUDO $PKG_MGR update -y --allowerasing || true
  $SUDO $PKG_MGR install -y --allowerasing git openssl ca-certificates jq || $SUDO $PKG_MGR install -y git openssl ca-certificates
elif [ "$PKG_MGR" = "apt" ]; then
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg lsb-release git openssl ufw jq
fi

# 3. Docker & Docker Compose Installation
echo -e "\n${BOLD}[3/7] Setting up Docker Engine & Docker Compose...${NC}"
if [ "$PKG_MGR" = "dnf" ] || [ "$PKG_MGR" = "yum" ]; then
  # Amazon Linux / RHEL / Fedora
  if ! command -v docker &> /dev/null; then
    echo "Installing Docker via $PKG_MGR..."
    $SUDO $PKG_MGR install -y --allowerasing docker
    $SUDO systemctl enable docker
    $SUDO systemctl start docker
  fi

  # Install docker compose plugin if not present
  if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    ARCH=$(uname -m)
    $SUDO mkdir -p /usr/local/lib/docker/cli-plugins /usr/libexec/docker/cli-plugins
    $SUDO curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose
    $SUDO chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    $SUDO cp /usr/local/lib/docker/cli-plugins/docker-compose /usr/libexec/docker/cli-plugins/docker-compose 2>/dev/null || true
    $SUDO ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/bin/docker-compose 2>/dev/null || true
  fi

  # Add user to docker group
  TARGET_USER="${SUDO_USER:-$USER}"
  $SUDO usermod -aG docker "$TARGET_USER" || true

elif [ "$PKG_MGR" = "apt" ]; then
  # Ubuntu / Debian
  if ! command -v docker &> /dev/null; then
    echo "Installing official Docker Engine for Ubuntu/Debian..."
    $SUDO install -m 0755 -d /etc/apt/keyrings
    $SUDO curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    $SUDO chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    $SUDO systemctl enable docker
    $SUDO systemctl start docker

    TARGET_USER="${SUDO_USER:-$USER}"
    $SUDO usermod -aG docker "$TARGET_USER" || true
  fi
fi
echo -e "${GREEN}✓ Docker Engine & Compose verified!${NC}"

# 4. Firewall Configuration (UFW on Ubuntu, AWS SG handles Amazon Linux)
echo -e "\n${BOLD}[4/7] Checking firewall settings...${NC}"
if command -v ufw &> /dev/null; then
  $SUDO ufw default deny incoming || true
  $SUDO ufw default allow outgoing || true
  $SUDO ufw allow 22/tcp comment 'SSH' || true
  $SUDO ufw allow 80/tcp comment 'HTTP' || true
  $SUDO ufw allow 443/tcp comment 'HTTPS' || true
  $SUDO ufw --force enable || true
  echo -e "${GREEN}✓ UFW rules enabled.${NC}"
else
  echo -e "${GREEN}✓ Host relies on AWS EC2 Security Group rules (Ports 22, 80, 443).${NC}"
fi

# 5. Production Environment Configuration (.env.production)
echo -e "\n${BOLD}[5/7] Initializing .env.production configuration...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p certbot/conf certbot/www

if [ ! -f .env.production ]; then
  echo "Generating fresh cryptographically secure production secrets..."
  GEN_JWT_ACCESS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
  GEN_JWT_REFRESH=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
  GEN_ENCRYPTION_KEY=$(openssl rand -hex 32) # Exactly 64 hex characters

  cat <<EOF > .env.production
# ReelMind Generated Production Environment
PORT=5001
NODE_ENV=production
CLIENT_URL=http://${PUBLIC_IP}
MONGODB_URI=mongodb://mongo:27017/reelmind

# Auto-Generated Cryptographic Secrets
JWT_ACCESS_SECRET=${GEN_JWT_ACCESS}
JWT_REFRESH_SECRET=${GEN_JWT_REFRESH}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=${GEN_ENCRYPTION_KEY}

# AI Provider Configuration (Default: local/offline fallback; configure in UI or below)
AI_PROVIDER=none
AI_API_KEY=
AI_MODEL=
EMBEDDING_MODEL=
AI_BASE_URL=

# Media Storage and Processing
UPLOAD_DIRECTORY=/app/uploads
THUMBNAIL_DIRECTORY=/app/thumbnails
MAX_UPLOAD_SIZE=524288000
MAX_CONCURRENT_JOBS=2
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
VECTOR_SEARCH_MODE=local
ATLAS_VECTOR_INDEX=scene_embedding_index

# UGREEN AI NAS Integration
NAS_PROVIDER=ugreen_ugos
NAS_BASE_URL=
NAS_CONNECTION_MODE=disconnected
EOF
  echo -e "${GREEN}✓ Created .env.production with auto-generated secure credentials.${NC}"
else
  echo -e "${YELLOW}! Existing .env.production found. Preserving existing secrets.${NC}"
fi

# 6. Build & Launch Containers
echo -e "\n${BOLD}[6/7] Building and starting ReelMind containers with Docker Compose...${NC}"
$SUDO docker compose -f docker-compose.prod.yml pull || true
$SUDO docker compose -f docker-compose.prod.yml build
$SUDO docker compose -f docker-compose.prod.yml up -d

# 7. Health Check Verification
echo -e "\n${BOLD}[7/7] Verifying service health...${NC}"
echo "Waiting for services to initialize..."
HEALTHY=false
for i in {1..30}; do
  if curl -s -f "http://localhost/api/v1/health" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 2
  echo -n "."
done

echo ""
if [ "$HEALTHY" = true ]; then
  echo -e "${GREEN}${BOLD}====================================================================${NC}"
  echo -e "${GREEN}${BOLD}   ✓ REELMIND DEPLOYMENT SUCCESSFUL!                                ${NC}"
  echo -e "${GREEN}${BOLD}====================================================================${NC}"
  echo -e "You can now access your ReelMind instance at:"
  echo -e "  🌐 Web App:      ${BOLD}http://${PUBLIC_IP}/${NC}"
  echo -e "  🩺 Health Check: ${BOLD}http://${PUBLIC_IP}/api/v1/health${NC}"
  echo ""
  echo -e "Useful Commands:"
  echo -e "  • View live logs:         ${YELLOW}sudo docker compose -f docker-compose.prod.yml logs -f${NC}"
  echo -e "  • Check container status: ${YELLOW}sudo docker compose -f docker-compose.prod.yml ps${NC}"
  echo -e "  • Restart application:    ${YELLOW}sudo docker compose -f docker-compose.prod.yml restart${NC}"
  echo -e "  • Setup Free SSL:         ${YELLOW}./deploy/setup-ssl.sh yourdomain.com${NC}"
  echo -e "===================================================================="
else
  echo -e "${RED}${BOLD}⚠ Deployment health check timed out.${NC}"
  echo -e "Inspect container logs with: ${YELLOW}sudo docker compose -f docker-compose.prod.yml logs${NC}"
fi
