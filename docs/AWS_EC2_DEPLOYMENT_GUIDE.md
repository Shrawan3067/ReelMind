# 🚀 ReelMind — AWS EC2 Production Deployment Guide

This guide walks you through deploying **ReelMind** (Autonomous AI Video Studio) onto an **Amazon Web Services (AWS) EC2** instance using Docker and Docker Compose.

---

## 🏗️ Architecture & Network Overview

```
                      Internet Traffic
                             │
                  [Port 80 / Port 443]
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ AWS EC2 Host (Ubuntu 24.04 LTS / 22.04 LTS)             │
  │                                                         │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ reelmind-client (Nginx 1.27 + React SPA)          │  │
  │  │  - Serves compiled UI assets                      │  │
  │  │  - Proxies /api/ ───► http://server:5001          │  │
  │  │  - Proxies /socket.io/ ───► ws://server:5001      │  │
  │  │  - Handles SSL termination via Certbot            │  │
  │  └─────────────────┬─────────────────────────────────┘  │
  │                    │ Internal Docker Network            │
  │                    ▼ (reelmind-net)                     │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ reelmind-server (Node.js 22 + Express + FFmpeg)   │  │
  │  │  - Zero publicly exposed ports                    │  │
  │  │  - Persistent storage: upload_data, thumb_data    │  │
  │  └─────────────────┬─────────────────────────────────┘  │
  │                    │ Internal Docker Network            │
  │                    ▼ (reelmind-net)                     │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ reelmind-mongo (MongoDB 7.0)                      │  │
  │  │  - Internal port 27017 (Not exposed to Internet!) │  │
  │  │  - Persistent storage: mongo_data                 │  │
  │  └───────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Zero Public Port Exposure for Databases**: MongoDB (port 27017) and Express (port 5001) are kept completely internal within Docker's private bridge network. Only ports 80 and 443 are exposed through Nginx, protecting your deployment from automated port scans and unauthorized access.

---

## 📋 Recommended EC2 Specifications

| Component | Minimum Viable | Recommended (Production) | High Volume / Heavy Video Rendering |
| :--- | :--- | :--- | :--- |
| **Instance Type** | `t3.small` (2 vCPU, 2 GB RAM + 4 GB swap) | `t3.medium` (2 vCPU, 4 GB RAM) | `t3.large` or `c6i.xlarge` (4 vCPU, 8 GB+ RAM) |
| **Operating System** | Ubuntu 24.04 LTS (64-bit x86_64) | Ubuntu 24.04 LTS (64-bit x86_64) | Ubuntu 24.04 LTS (64-bit x86_64) |
| **Storage (EBS)** | 30 GB gp3 SSD | 50 GB gp3 SSD | 100 GB+ gp3 SSD |
| **Network** | Up to 5 Gbps | Up to 5 Gbps | Up to 12.5 Gbps |

---

## 1️⃣ Step 1: Launch an AWS EC2 Instance

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/ec2/).
2. Navigate to **EC2** > **Instances** > click **Launch an instance**.
3. **Name**: `ReelMind-Production`
4. **Application and OS Images (AMI)**: Select **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type** (64-bit x86).
5. **Instance Type**: Select `t3.medium` (or `t3.small`).
6. **Key Pair (login)**:
   - Select an existing key pair or click **Create new key pair**.
   - Type: RSA, Format: `.pem`.
   - Download and save the `.pem` file safely (e.g., `~/.ssh/reelmind-key.pem`).
   - Run locally: `chmod 400 ~/.ssh/reelmind-key.pem`.
7. **Network Settings**:
   - Check **Allow SSH traffic from**: Anywhere (or "My IP" for enhanced security).
   - Check **Allow HTTP traffic from the internet**.
   - Check **Allow HTTPS traffic from the internet**.
8. **Configure Storage**: Set size to **30 GiB** or **50 GiB** `gp3`.
9. Click **Launch instance**.
10. Once running, note your instance's **Public IPv4 address** (e.g., `54.210.45.123`).

---

## 2️⃣ Step 2: Verify AWS Security Group Inbound Rules

Ensure your EC2 Security Group contains the following Inbound Rules:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `0.0.0.0/0` (or your IP) | Remote terminal access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Web application & ACME challenge |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL web application |

*(Do **not** open ports 5001 or 27017 in the security group).*

---

## 3️⃣ Step 3: Connect via SSH

Open your local terminal and connect to your EC2 instance:

```bash
ssh -i ~/.ssh/reelmind-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

*(Replace `<YOUR_EC2_PUBLIC_IP>` with your actual EC2 public IP address).*

---

## 4️⃣ Step 4: Deploy ReelMind

### Option A: Automated One-Command Setup (Recommended)

1. Clone your ReelMind repository:
   ```bash
   git clone https://github.com/<your-username>/ReelMind.git
   cd ReelMind
   ```
   *(Or transfer files directly via SCP/rsync if using a private repo).*

2. Run the automated EC2 setup script:
   ```bash
   chmod +x deploy/aws-ec2-setup.sh
   ./deploy/aws-ec2-setup.sh
   ```

The script will automatically:
- Update all Ubuntu packages
- Install Docker Engine & Docker Compose
- Configure the UFW firewall (allowing SSH, HTTP, HTTPS)
- Generate cryptographically secure 64-character encryption keys and JWT secrets
- Create `.env.production` configured with your EC2 public IP
- Build and boot the entire stack with Docker Compose
- Run a health check to confirm service availability

Once complete, open `http://<YOUR_EC2_PUBLIC_IP>` in your browser!

---

### Option B: Manual Setup

If you prefer to configure everything manually step by step:

#### 1. Install Docker & Docker Compose
```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git openssl ufw

# Install Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

#### 2. Configure Firewall
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

#### 3. Clone Repository & Setup Environment
```bash
git clone https://github.com/<your-username>/ReelMind.git
cd ReelMind

# Create production environment file from template
cp .env.production.example .env.production
```

Generate secure production secrets:
```bash
# Generate 64-char hex key for AES-256 encryption
openssl rand -hex 32

# Generate JWT secrets
openssl rand -base64 32
```

Edit `.env.production` (`nano .env.production`):
```ini
PORT=5001
NODE_ENV=production
CLIENT_URL=http://<YOUR_EC2_PUBLIC_IP>
MONGODB_URI=mongodb://mongo:27017/reelmind
JWT_ACCESS_SECRET=<paste_generated_jwt_secret>
JWT_REFRESH_SECRET=<paste_generated_jwt_refresh_secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=<paste_generated_64_char_hex_key>
AI_PROVIDER=none
```

#### 4. Build and Start the Production Containers
```bash
mkdir -p certbot/conf certbot/www
sudo docker compose -f docker-compose.prod.yml up -d --build
```

#### 5. Verify Running Services
```bash
sudo docker compose -f docker-compose.prod.yml ps
curl -i http://localhost/api/v1/health
```

---

## 5️⃣ Step 5: (Optional) Setup Custom Domain & Free SSL with Let's Encrypt

If you have a domain name (e.g. `reelmind.yourdomain.com`):

1. **Create DNS A Record**:
   - Go to your DNS registrar (Route 53, Cloudflare, GoDaddy, Namecheap).
   - Add an `A` record pointing `reelmind.yourdomain.com` to your EC2 Public IPv4 address.
   - Wait 1–2 minutes for DNS propagation.

2. **Run the SSL Setup Script**:
   ```bash
   ./deploy/setup-ssl.sh reelmind.yourdomain.com your-email@example.com
   ```

This will automatically:
- Issue a trusted SSL/TLS certificate via Let's Encrypt
- Configure Nginx with HTTP/2 and modern SSL ciphers
- Enforce automatic HTTP ──► HTTPS redirection
- Update `.env.production` `CLIENT_URL` to `https://reelmind.yourdomain.com`
- Gracefully reload Nginx and restart the API server

---

## 6️⃣ Operational & Maintenance Commands

### Check Container Status
```bash
sudo docker compose -f docker-compose.prod.yml ps
```

### View Live Container Logs
```bash
# All services
sudo docker compose -f docker-compose.prod.yml logs -f

# Backend API only
sudo docker compose -f docker-compose.prod.yml logs -f server

# Frontend Nginx only
sudo docker compose -f docker-compose.prod.yml logs -f client

# Database only
sudo docker compose -f docker-compose.prod.yml logs -f mongo
```

### Restart Services
```bash
sudo docker compose -f docker-compose.prod.yml restart
```

### Pull Updates & Rebuild (Zero Downtime)
```bash
chmod +x deploy/update.sh
./deploy/update.sh
```

### Database Backup & Restore
```bash
# Backup MongoDB to host directory
sudo docker exec reelmind-mongo mongodump --db reelmind --out /data/db/backup_$(date +%F)

# Copy backup from container volume to host
sudo docker cp reelmind-mongo:/data/db/backup_$(date +%F) ./mongo_backup_$(date +%F)

# Restore MongoDB from backup
sudo docker exec reelmind-mongo mongorestore --db reelmind /data/db/backup_<DATE>/reelmind
```

---

## 🛠️ Performance Tuning & Troubleshooting

### 1. Enabling Swap Memory on `t3.small` / `t3.medium` instances
If using a smaller instance type, configure 4 GB of swap space to prevent memory exhaustion during heavy FFmpeg video rendering or concurrent AI operations:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. "502 Bad Gateway" in Browser
- Check if the backend server container is healthy:
  ```bash
  sudo docker compose -f docker-compose.prod.yml ps
  ```
- If `reelmind-server` is in restarting state, inspect the logs:
  ```bash
  sudo docker compose -f docker-compose.prod.yml logs server
  ```
- Common reason: Default development secrets used in `NODE_ENV=production`. Verify that `ENCRYPTION_KEY` is a fresh 64-character hex string and `JWT_ACCESS_SECRET` does not contain `dev-reelmind`.

### 3. Large Video Uploads Failing
- ReelMind's Nginx is pre-configured with `client_max_body_size 500M;` and 300-second timeouts. If you wish to allow uploads larger than 500MB, update `client_max_body_size` in `client/nginx.conf` and `MAX_UPLOAD_SIZE` in `.env.production`.

---

## 🔒 Security Best Practices

1. **Keep Secrets Secret**: Never commit `.env.production` to your Git repository. It is included in `.gitignore`.
2. **Restrict SSH Access**: In your AWS Security Group, change SSH (port 22) from `0.0.0.0/0` to **My IP** so only your computer can initiate SSH connections.
3. **Automated SSL Renewal**: Let's Encrypt certificates are valid for 90 days. Set up a monthly cron job to auto-renew:
   ```bash
   (crontab -l 2>/dev/null; echo "0 3 1 * * docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt -v $(pwd)/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker exec reelmind-client nginx -s reload") | crontab -
   ```
4. **Regular Backups**: Snapshot your EC2 root EBS volume periodically or back up the `reelmind_upload_data` and `reelmind_mongo_data` volumes.
