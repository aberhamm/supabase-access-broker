#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# deploy.sh — manual deploy helper for the Supabase Access Broker
#
# Production auto-deploys from main via a cron poller on the Hetzner box
# (deploy-poll.sh → pull-and-build.sh). This script exists for:
#   - Force-deploying when the poller won't (e.g. red CI on a known-good commit)
#   - Syncing env changes without a code change
#   - Operational tasks (logs, status, restart, ssh, migrations)
#
# The remote server manages code via git (pull-and-build.sh does
# git fetch + reset --hard). Do NOT rsync source — it would be clobbered
# on the next cron tick.
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load configuration
CONFIG_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}Error: .env.deploy not found${NC}"
    echo "Copy .env.deploy.example to .env.deploy and configure your VM settings"
    exit 1
fi

source "$CONFIG_FILE"

: "${DEPLOY_HOST:?DEPLOY_HOST not set in .env.deploy}"
: "${DEPLOY_USER:?DEPLOY_USER not set in .env.deploy}"
: "${DEPLOY_PATH:?DEPLOY_PATH not set in .env.deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

SSH_OPTS="-o StrictHostKeyChecking=accept-new -p ${DEPLOY_PORT}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && SSH_OPTS="$SSH_OPTS -i $DEPLOY_SSH_KEY"
SSH_CMD="ssh $SSH_OPTS ${DEPLOY_USER}@${DEPLOY_HOST}"

log()     { echo -e "${BLUE}[deploy]${NC} $1"; }
success() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $1"; }
error()   { echo -e "${RED}[deploy]${NC} $1"; }

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

# Full deploy: git pull + compose build + up (same as what the cron poller runs)
do_deploy() {
    log "Deploying to ${DEPLOY_HOST}..."

    $SSH_CMD bash <<'REMOTE'
set -e
cd /opt/apps/access
echo "=== Pulling latest code ==="
bash pull-and-build.sh
echo ""
echo "=== Container status ==="
docker compose -f docker-compose.prod.yml ps
REMOTE

    success "Deployment complete!"
    log "Site: https://access.matthew.systems"
}

# Sync .env.production → remote .env (for env-only changes, no rebuild)
do_sync_env() {
    local local_env="${SCRIPT_DIR}/.env.production"

    if [[ ! -f "$local_env" ]]; then
        error ".env.production not found locally"
        echo "Create it from the example: cp .env.example .env.production"
        exit 1
    fi

    log "Syncing .env.production to ${DEPLOY_HOST}..."

    rsync -avz \
        -e "ssh $SSH_OPTS" \
        "$local_env" \
        "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env"

    success ".env synced to remote"

    echo ""
    log "Key settings on remote:"
    $SSH_CMD "grep -E '^(NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_AUTH_)' ${DEPLOY_PATH}/.env 2>/dev/null || true"

    echo ""
    warn "Env-only changes need a rebuild to take effect (NEXT_PUBLIC_* is baked at build time)."
    warn "Run: ./scripts/deploy.sh deploy"
}

# Rebuild + restart without pulling new code (useful after sync-env)
do_rebuild() {
    log "Rebuilding on ${DEPLOY_HOST} (no git pull)..."

    $SSH_CMD bash <<'REMOTE'
set -e
cd /opt/apps/access
echo "=== Building ==="
docker compose -f docker-compose.prod.yml build
echo "=== Restarting ==="
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f
echo ""
echo "=== Container status ==="
docker compose -f docker-compose.prod.yml ps
REMOTE

    success "Rebuild complete!"
}

# Quick restart (no rebuild, no pull)
do_restart() {
    log "Restarting containers..."

    $SSH_CMD bash <<'REMOTE'
set -e
cd /opt/apps/access
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml ps
REMOTE

    success "Services restarted"
}

# Show container logs
do_logs() {
    local service="${1:-}"
    log "Fetching logs..."

    if [[ -n "$service" ]]; then
        $SSH_CMD "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml logs -f --tail=100 $service"
    else
        $SSH_CMD "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml logs -f --tail=50"
    fi
}

# Show status
do_status() {
    log "Checking deployment status..."

    $SSH_CMD bash <<'REMOTE'
cd /opt/apps/access
echo ""
echo "=== Git ==="
git log --oneline -3
echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps
echo ""
echo "=== Resource Usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
echo ""
echo "=== Health Check ==="
curl -s http://localhost:3050/api/health 2>/dev/null || echo "Health endpoint not responding"
REMOTE
}

# Run database migrations locally (connects directly to Supabase)
do_migrate() {
    local env_file="${SCRIPT_DIR}/.env.production"

    if [[ ! -f "$env_file" ]]; then
        error ".env.production not found"
        echo "Migrations connect directly to Supabase using credentials from .env.production"
        exit 1
    fi

    log "Running database migrations (connecting directly to Supabase)..."

    cd "$SCRIPT_DIR"

    if command -v pnpm >/dev/null 2>&1; then
        pnpm migrate
    elif command -v npm >/dev/null 2>&1; then
        npm run migrate
    else
        error "pnpm or npm is required to run migrations"
        exit 1
    fi

    success "Migrations completed"
}

# SSH into the remote server
do_ssh() {
    log "Connecting to ${DEPLOY_HOST}..."
    $SSH_CMD -t "cd ${DEPLOY_PATH} 2>/dev/null || true; bash"
}

# Print usage
usage() {
    cat << 'EOF'
Usage: ./scripts/deploy.sh [command]

Production auto-deploys from main via the Hetzner cron poller.
This script is for manual operations and force-deploys.

Commands:
  deploy        Pull latest code, build, and restart (same as auto-deploy)  [default]
  rebuild       Rebuild + restart without pulling new code (after sync-env)
  restart       Quick restart without rebuilding
  sync-env      Sync local .env.production to remote .env
  migrate       Run database migrations (locally, connects to Supabase directly)
  logs [svc]    Show container logs (optionally for a specific service)
  status        Show container status, git HEAD, and health check
  ssh           SSH into the remote server
  help          Show this help message

Examples:
  ./scripts/deploy.sh                  # Full deploy (git pull + build + restart)
  ./scripts/deploy.sh sync-env        # Push env changes to remote
  ./scripts/deploy.sh rebuild         # Rebuild after env change (no git pull)
  ./scripts/deploy.sh logs app        # Tail app logs
  ./scripts/deploy.sh status          # Check what's running

EOF
}

# Main
main() {
    local cmd="${1:-deploy}"

    case "$cmd" in
        deploy)         do_deploy ;;
        rebuild)        do_rebuild ;;
        restart)        do_restart ;;
        sync-env)       do_sync_env ;;
        migrate)        do_migrate ;;
        logs)           do_logs "${2:-}" ;;
        status)         do_status ;;
        ssh)            do_ssh ;;
        help|--help|-h) usage ;;
        *)
            error "Unknown command: $cmd"
            usage
            exit 1
            ;;
    esac
}

main "$@"
