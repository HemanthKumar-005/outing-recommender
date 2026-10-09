# Production Deployment Guide — Outing Recommender Platform

This guide outlines how to deploy the **Nearby & Co. Outing Recommendation Platform** to a single-server Virtual Private Server (VPS), cloud VM (AWS EC2, DigitalOcean Droplet, Linode, Hetzner), or dedicated host.

---

## Architecture Overview

```
                      INTERNET
                         │
                 ┌───────▼───────┐
                 │  Ports 80/443 │
                 │  Nginx Proxy  │ (SSL, gzip, rate limiting, security headers)
                 └───┬───────┬───┘
                     │       │
       / (frontend)  │       │  /api/ (backend)
         ┌───────────▼┐     ┌▼──────────┐
         │  Next.js   │     │   API     │
         │  Frontend  │     │ Gateway   │
         │ (port 3000)│     │(port 8000)│
         └────────────┘     └───┬───────┘
                                │ Internal Docker Network (No public ports exposed)
         ┌──────────────────────┼───────────────────────┐
         │                      │                       │
 ┌───────▼────────┐     ┌───────▼────────┐      ┌───────▼────────┐
 │  user-service  │     │ place-service  │      │context-service │
 └───────┬────────┘     └───────┬────────┘      └───────┬────────┘
         │                      │                       │
 ┌───────▼────────┐     ┌───────▼────────┐      ┌───────▼────────┐
 │interaction-svc │     │recommendation- │      │ itinerary-svc  │
 └───────┬────────┘     │     engine     │      └───────┬────────┘
         │              └───────┬────────┘              │
 ┌───────▼────────┐             │               ┌───────▼────────┐
 │notification-svc│             │               │workers (model, │
 └───────┬────────┘             │               │   sentiment)   │
         │                      │               └───────┬────────┘
 ┌───────┴──────────────────────┴───────────────────────┴────────┐
 │                    PostgreSQL 16 (RLS multi-tenant)           │
 │                    RabbitMQ 3 (Topic exchange event bus)      │
 │                    Redis 7 (Distributed cache & rate limits)  │
 └───────────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites

- A Linux server (Ubuntu 22.04 LTS or 24.04 LTS recommended) with at least:
  - **4 GB RAM** (8 GB recommended for concurrent microservices + XGBoost)
  - **2 vCPUs**
  - **20 GB SSD storage**
- **Docker Engine** (24.0+) & **Docker Compose v2** installed
- A domain name pointing its `A` record to your server's public IP (for SSL)

---

## 2. Server Preparation (Ubuntu/Debian)

### Install Docker Engine & Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Configure Firewall (UFW)
Only expose ports 22 (SSH), 80 (HTTP), and 443 (HTTPS). All internal microservice ports (5432, 5672, 6379, 8001–8007) remain strictly isolated inside the Docker network.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Clone & Configure

```bash
git clone https://github.com/HemanthKumar-005/outing-recommender.git /opt/outing-recommender
cd /opt/outing-recommender

# Create your production environment file
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```

Update the following keys in `deploy/.env.production`:
- `POSTGRES_PASSWORD`: Use a strong, random password.
- `RABBITMQ_PASS`: Use a strong password.
- `DOMAIN_NAME`: Set to your real domain (e.g., `explore.yourdomain.com`).

---

## 4. One-Click Deployment

### On Linux / macOS:
```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/deploy.sh
```

### On Windows / PowerShell:
```powershell
.\deploy\scripts\deploy.ps1
```

The script will:
1. Verify Docker and Compose availability.
2. Build all production images (Next.js standalone + 10 Python microservices).
3. Start containers in detached mode.
4. Wait for PostgreSQL to complete schema setup and pass health checks.
5. Initialize the XGBoost recommendation model.
6. Verify Nginx reverse proxy routing.

---

## 5. Seed Initial Data

Once the platform is running, seed sample users and the **310 curated pan-India places**:

```bash
# Install requests if running from host:
pip install requests pyyaml

# Run the seeding script against the running gateway:
python3 scripts/seed_data.py
```

---

## 6. Setting Up Free SSL (Let's Encrypt / Certbot)

Once your domain is resolving to the server IP:

1. Obtain the SSL certificate using Certbot standalone:
```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/lib/docker/volumes/outing-recommender_certbot_www/_data \
  -d yourdomain.com -d www.yourdomain.com
```

2. Uncomment the SSL block in `deploy/nginx/default.conf`.
3. Reload Nginx without downtime:
```bash
docker compose -f deploy/docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 7. Auto-Start on System Boot (Systemd)

To ensure the platform starts automatically after server reboots:

```bash
sudo cp deploy/systemd/outing-recommender.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable outing-recommender.service
```

---

## 8. Automated Database Backups

A backup script with a 14-day retention policy is included:

```bash
# Test manual backup
./deploy/scripts/backup-db.sh

# Automate daily backups via cron at 2:00 AM:
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/outing-recommender/deploy/scripts/backup-db.sh >> /var/log/outing-backup.log 2>&1") | crontab -
```

---

## 9. Useful Operations & Commands

| Task | Command |
|---|---|
| View container status | `docker compose -f deploy/docker-compose.prod.yml ps` |
| View live logs | `docker compose -f deploy/docker-compose.prod.yml logs -f [service_name]` |
| Restart all services | `docker compose -f deploy/docker-compose.prod.yml restart` |
| Stop all services | `docker compose -f deploy/docker-compose.prod.yml down` |
| Inspect catalog stats | `python scripts/import_places.py --stats` |
| Zero-downtime update | `git pull && ./deploy/scripts/deploy.sh` |
