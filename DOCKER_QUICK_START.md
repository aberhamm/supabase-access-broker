# Docker Quick Start

Get your application running in Docker in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Supabase project with custom claims functions

## Step 1: Environment Setup

Copy the Docker example environment file:

```bash
cp .env.docker.example .env.production
```

Edit `.env.production` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# IMPORTANT: Set this to your production domain for auth redirects
# This ensures magic links and password resets redirect to the correct URL
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# Optional: enable additional login methods gradually
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true
```

**Note:** `NEXT_PUBLIC_APP_URL` is critical for production. Without it, auth magic links may redirect to `localhost`.

**Passkeys note:** Passkeys (WebAuthn) require HTTPS in production and are bound to the portal host. Use a real HTTPS domain when testing passkeys in Docker.

## Step 2: Build and Start

### Option A: Using Make (Recommended)

```bash
# Build and start
make build
make up

# View logs
make logs

# Stop
make down
```

### Option B: Using Docker Compose

```bash
# Build and start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Step 3: Access Application

Open your browser to:

- **Application:** http://localhost:3050
- **Health Check:** http://localhost:3050/api/health

## Production Deployment

For production with nginx:

```bash
# Using Make
make prod-up

# Or using Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

Access at:
- **HTTP:** http://localhost
- **Health:** http://localhost/health

## Common Commands

```bash
# Development
make up          # Start containers
make logs        # View logs
make restart     # Restart containers
make down        # Stop containers
make rebuild     # Rebuild and restart
make health      # Check health

# Production
make prod-up     # Start production stack
make prod-logs   # View production logs
make prod-down   # Stop production stack
```

## Troubleshooting

### Container won't start

```bash
# Check logs
make logs

# Rebuild
make rebuild
```

### Port already in use

```bash
# Check what's using port 3050
lsof -i :3050

# Kill the process or change port in docker-compose.yml
```

### Can't connect

```bash
# Check if container is running
docker ps

# Check health
make health
```

## Next Steps

- Read [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for complete guide
- Configure SSL for production
- Set up automatic backups
- Configure monitoring

## Resources

- [Full Deployment Guide](./DOCKER_DEPLOYMENT.md)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

---

**Need help?** Check the [full deployment guide](./DOCKER_DEPLOYMENT.md) or open an issue.
