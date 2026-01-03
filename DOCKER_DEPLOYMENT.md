# Docker Deployment Guide

Complete guide for deploying Supabase Access Broker using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Production Deployment](#production-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- Supabase project with custom claims functions installed
- Environment variables from your Supabase project

### Verify Installation

```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd supabase-access-broker

# Copy Docker environment file
cp .env.docker.example .env.production

# Edit environment variables
nano .env.production
```

### 2. Configure Environment Variables

Edit `.env.production` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRITICAL: Production app URL for auth redirects
# Set this to your production domain to ensure magic links and password resets work correctly
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# Optional: enable additional login methods gradually
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true

NODE_ENV=production
PORT=3050
HOSTNAME=0.0.0.0
```

### 3. Build and Run

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f app

# Check status
docker-compose ps
```

### 4. Access the Application

Open your browser to:
- **Application:** http://localhost:3050
- **Health Check:** http://localhost:3050/api/health

> **Port Reference:**
> | Deployment Type | Access URL | Internal Port |
> |-----------------|------------|---------------|
> | Basic (`docker-compose.yml`) | `http://localhost:3050` | 3050 |
> | Production with Nginx (`docker-compose.prod.yml`) | `http://localhost` (port 80) or `https://yourdomain.com` (port 443) | 3050 (proxied) |
>
> The app always runs on port 3050 internally. With Nginx, external traffic on 80/443 is proxied to the app.

## Configuration

### Docker Files Overview

```
.
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Basic Docker Compose setup
├── docker-compose.prod.yml    # Production with nginx
├── .dockerignore             # Files to exclude from build
├── nginx/
│   └── nginx.conf            # Nginx configuration
└── .env.production           # Production environment variables
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (SECRET) |
| `NEXT_PUBLIC_APP_URL` | **Yes (Prod)** | Production domain for auth redirects (e.g., `https://admin.yourdomain.com`) - **CRITICAL for magic links** |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Port to run on (default: 3050) |
| `HOSTNAME` | No | Hostname to bind (default: 0.0.0.0) |

## Deployment Options

### Option 1: Basic Deployment (Recommended for Testing)

Uses `docker-compose.yml` - exposes the Next.js app directly on port 3050.

```bash
# Build and start
docker-compose up -d

# Stop
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

**Best for:**
- Development/staging environments
- Internal networks
- Testing before production

### Option 2: Production Deployment with Nginx

Uses `docker-compose.prod.yml` - includes nginx reverse proxy with SSL support.

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

**Features:**
- Nginx reverse proxy
- SSL/TLS termination
- Rate limiting
- Static file caching
- Security headers
- Health checks

**Best for:**
- Production environments
- Public-facing deployments
- High-traffic applications

## Production Deployment

### Step 1: Prepare SSL Certificates

For HTTPS support, you need SSL certificates:

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to nginx/ssl directory
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/certificate.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/private.key
```

#### Option B: Self-Signed (Development/Testing Only)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/private.key \
  -out nginx/ssl/certificate.crt
```

### Step 2: Configure Nginx for HTTPS

Edit `nginx/nginx.conf` and uncomment the HTTPS server block. Update `server_name` with your domain:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

### Step 3: Create Production Environment File

```bash
# Create production env file
cat > .env.production << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
PORT=3050
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=https://yourdomain.com
EOF
```

### Step 4: Deploy

```bash
# Build and start production stack
docker-compose -f docker-compose.prod.yml up -d --build

# Verify services are running
docker-compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost/health
```

### Step 5: Configure DNS

Point your domain to your server's IP address:

```
A Record: yourdomain.com → your.server.ip
A Record: www.yourdomain.com → your.server.ip
```

### Step 6: Test SSL

```bash
# Test HTTPS connection
curl https://yourdomain.com/api/health

# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

## Docker Commands Reference

### Building

```bash
# Build the image
docker-compose build

# Build with no cache
docker-compose build --no-cache

# Build specific service
docker-compose build app
```

### Running

```bash
# Start in detached mode
docker-compose up -d

# Start with logs
docker-compose up

# Start specific service
docker-compose up -d app
```

### Managing

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs app

# Follow logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app

# Restart service
docker-compose restart app

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Maintenance

```bash
# Update and restart
docker-compose pull
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build

# View resource usage
docker stats

# Execute command in container
docker-compose exec app sh

# View container details
docker inspect supabase-access-broker
```

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:

```bash
# Check application health
curl http://localhost:3050/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "environment": "production"
}
```

### Logs

View and monitor logs:

```bash
# View all logs
docker-compose logs

# Follow app logs
docker-compose logs -f app

# Follow nginx logs
docker-compose logs -f nginx

# Export logs to file
docker-compose logs > logs.txt
```

### Backups

No database backups are needed as this application uses Supabase. However, you should:

1. **Backup environment variables:**
   ```bash
   cp .env.production .env.production.backup
   ```

2. **Backup nginx configuration:**
   ```bash
   cp nginx/nginx.conf nginx/nginx.conf.backup
   ```

3. **Backup SSL certificates:**
   ```bash
   tar -czf ssl-backup.tar.gz nginx/ssl/
   ```

### Updates

To update the application:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Or for production
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Security Best Practices

1. **Never commit sensitive files:**
   - `.env.production`
   - `nginx/ssl/*.key`
   - `nginx/ssl/*.crt`

2. **Secure your service role key:**
   - Never expose in client-side code
   - Never log the key
   - Rotate periodically

3. **Keep Docker updated:**
   ```bash
   docker version
   docker-compose version
   ```

4. **Monitor container security:**
   ```bash
   docker scan supabase-access-broker
   ```

5. **Use secrets management** (for advanced deployments):
   - Docker Secrets
   - HashiCorp Vault
   - AWS Secrets Manager

## Troubleshooting

### Container Won't Start

**Problem:** Container exits immediately

**Solution:**
```bash
# Check logs for errors
docker-compose logs app

# Common issues:
# 1. Missing environment variables
# 2. Port already in use
# 3. Build errors

# Check if port is in use
lsof -i :3050

# Try rebuilding
docker-compose build --no-cache
docker-compose up
```

### Can't Connect to Application

**Problem:** Unable to access http://localhost:3050

**Solution:**
```bash
# 1. Check if container is running
docker-compose ps

# 2. Check port mapping
docker port supabase-access-broker

# 3. Check firewall rules
sudo ufw status

# 4. Check nginx logs (if using prod compose)
docker-compose -f docker-compose.prod.yml logs nginx

# 5. Test from inside container
docker-compose exec app wget -O- http://localhost:3050/api/health
```

### Health Check Failing

**Problem:** Container shows unhealthy status

**Solution:**
```bash
# Check health status
docker inspect supabase-access-broker | grep -A 10 Health

# Test health endpoint manually
docker-compose exec app node -e "require('http').get('http://localhost:3050/api/health', (r) => {console.log(r.statusCode)})"

# View detailed logs
docker-compose logs --tail=50 app
```

### Build Errors

**Problem:** Docker build fails

**Solution:**
```bash
# Clear Docker cache
docker builder prune -a

# Remove old images
docker image prune -a

# Rebuild with verbose output
docker-compose build --no-cache --progress=plain

# Check Dockerfile syntax
docker build -t test-build .
```

### Out of Memory

**Problem:** Container using too much memory

**Solution:**
```bash
# Check memory usage
docker stats supabase-access-broker

# Limit memory in docker-compose.yml:
services:
  app:
    mem_limit: 1g
    mem_reservation: 512m

# Restart with limits
docker-compose up -d
```

### SSL Certificate Issues

**Problem:** SSL errors or expired certificates

**Solution:**
```bash
# Check certificate expiration
openssl x509 -in nginx/ssl/certificate.crt -noout -enddate

# Renew Let's Encrypt certificate
sudo certbot renew

# Update nginx certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/certificate.crt
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/private.key

# Reload nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Nginx Won't Start

**Problem:** Nginx container fails to start

**Solution:**
```bash
# Check nginx configuration syntax
docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx nginx -t

# Check nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# Common issues:
# 1. Port 80/443 already in use
# 2. Invalid nginx.conf syntax
# 3. Missing SSL certificates
```

## Advanced Configuration

### Custom Domain Configuration

Update `nginx/nginx.conf`:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

### Environment-Specific Compose Files

```bash
# Development
docker-compose -f docker-compose.yml up -d

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling (if needed in future)

```bash
# Scale to multiple instances (behind load balancer)
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Copy files to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          source: "."
          target: "/app"

      - name: Deploy with docker-compose
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /app
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d --build
```

## Performance Optimization

### Optimize Build Cache

The Dockerfile uses multi-stage builds for optimal caching:
- Dependencies layer cached separately
- Rebuild only what changed
- Minimal final image size

### Optimize Nginx

Already configured in `nginx.conf`:
- Gzip compression enabled
- Static file caching (365 days)
- Keep-alive connections
- Rate limiting for API routes

### Optimize Next.js

Already configured in `next.config.ts`:
- Standalone output for Docker
- Optimized production builds

## Resources

- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker and nginx logs
3. Check Supabase dashboard for auth issues
4. Open an issue on GitHub

---

**Summary:**

✅ Production-ready Docker configuration
✅ Multi-stage builds for optimization
✅ Nginx reverse proxy with SSL support
✅ Health checks and monitoring
✅ Security best practices
✅ Comprehensive troubleshooting guide

Your application is now ready for production deployment with Docker! 🚀
