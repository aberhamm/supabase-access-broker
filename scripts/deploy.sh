#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load configuration
CONFIG_FILE="${SCRIPT_DIR}/.env.deploy"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}Error: .env.deploy not found${NC}"
    echo "Copy .env.deploy.example to .env.deploy and configure your VM settings"
    exit 1
fi

source "$CONFIG_FILE"

# Validate required config
: "${DEPLOY_HOST:?DEPLOY_HOST not set in .env.deploy}"
: "${DEPLOY_USER:?DEPLOY_USER not set in .env.deploy}"
: "${DEPLOY_PATH:?DEPLOY_PATH not set in .env.deploy}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

# Image name
IMAGE_NAME="${IMAGE_NAME:-claims-admin-dashboard}"

# Build SSH command
SSH_OPTS="-o StrictHostKeyChecking=accept-new -p ${DEPLOY_PORT}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
    SSH_OPTS="$SSH_OPTS -i $DEPLOY_SSH_KEY"
fi
SSH_CMD="ssh $SSH_OPTS ${DEPLOY_USER}@${DEPLOY_HOST}"

log() {
    echo -e "${BLUE}[deploy]${NC} $1"
}

success() {
    echo -e "${GREEN}[deploy]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[deploy]${NC} $1"
}

error() {
    echo -e "${RED}[deploy]${NC} $1"
}

# Build image locally
build_image() {
    log "Building Docker image locally..."
    cd "$SCRIPT_DIR"

    # Read build args from .env.production if it exists
    local build_args=""
    if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
        local supabase_url=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "${SCRIPT_DIR}/.env.production" | cut -d'=' -f2-)
        local supabase_anon=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "${SCRIPT_DIR}/.env.production" | cut -d'=' -f2-)
        local app_url=$(grep -E '^NEXT_PUBLIC_APP_URL=' "${SCRIPT_DIR}/.env.production" | cut -d'=' -f2-)

        [[ -n "$supabase_url" ]] && build_args="$build_args --build-arg NEXT_PUBLIC_SUPABASE_URL=$supabase_url"
        [[ -n "$supabase_anon" ]] && build_args="$build_args --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_anon"
        [[ -n "$app_url" ]] && build_args="$build_args --build-arg NEXT_PUBLIC_APP_URL=$app_url"

        log "Building with NEXT_PUBLIC_APP_URL=${app_url:-not set}"
    else
        warn "No .env.production found - building without NEXT_PUBLIC_* vars"
    fi

    docker build -t "$IMAGE_NAME" $build_args .

    success "Image built successfully"
}

# Push image to server via SSH
push_image() {
    log "Pushing image to ${DEPLOY_HOST}..."

    docker save "$IMAGE_NAME" | gzip | $SSH_CMD "docker load"

    success "Image transferred"
}

# Sync source code to server (for remote builds)
sync_source() {
    log "Syncing source code to ${DEPLOY_HOST}..."

    # Create a temporary excludes file
    local excludes_file=$(mktemp)
    cat > "$excludes_file" << 'EXCLUDES'
node_modules/
.git/
.next/
.env
.env.local
.env.*.local
.DS_Store
*.log
.turbo/
.cursor/
nginx/logs/
nginx/ssl/
EXCLUDES

    rsync -avz --delete \
        -e "ssh $SSH_OPTS" \
        --exclude-from="$excludes_file" \
        "${SCRIPT_DIR}/" \
        "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

    rm "$excludes_file"
    success "Source code synced"
}

# Build image on remote server
build_image_remote() {
    log "Building image on remote server..."

    $SSH_CMD bash << EOF
set -e
cd ${DEPLOY_PATH}

# Read build args from .env.production
BUILD_ARGS=""
if [[ -f ".env.production" ]]; then
    SUPABASE_URL=\$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.production | cut -d'=' -f2- || true)
    SUPABASE_ANON=\$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.production | cut -d'=' -f2- || true)
    APP_URL=\$(grep -E '^NEXT_PUBLIC_APP_URL=' .env.production | cut -d'=' -f2- || true)

    [[ -n "\$SUPABASE_URL" ]] && BUILD_ARGS="\$BUILD_ARGS --build-arg NEXT_PUBLIC_SUPABASE_URL=\$SUPABASE_URL"
    [[ -n "\$SUPABASE_ANON" ]] && BUILD_ARGS="\$BUILD_ARGS --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=\$SUPABASE_ANON"
    [[ -n "\$APP_URL" ]] && BUILD_ARGS="\$BUILD_ARGS --build-arg NEXT_PUBLIC_APP_URL=\$APP_URL"

    echo "Building with NEXT_PUBLIC_APP_URL=\${APP_URL:-not set}"
fi

echo "Building Docker image..."
docker build --no-cache -t ${IMAGE_NAME} \$BUILD_ARGS .

echo "Image built successfully"
EOF

    success "Remote build completed"
}

# Initialize remote server (first-time setup)
init_remote() {
    log "Initializing remote server..."

    $SSH_CMD bash << EOF
set -e
if [ -w "${DEPLOY_PATH%/*}" ] || [ -d "${DEPLOY_PATH}" ]; then
    mkdir -p ${DEPLOY_PATH}
    mkdir -p ${DEPLOY_PATH}/nginx/logs
    mkdir -p ${DEPLOY_PATH}/nginx/ssl
else
    sudo mkdir -p ${DEPLOY_PATH}
    sudo mkdir -p ${DEPLOY_PATH}/nginx/logs
    sudo mkdir -p ${DEPLOY_PATH}/nginx/ssl
    sudo chown -R \$(whoami):\$(whoami) ${DEPLOY_PATH}
fi
echo "Directory created: ${DEPLOY_PATH}"
EOF

    success "Remote directory initialized"
}

# Sync deploy config files to remote
sync_config() {
    log "Syncing configuration files..."

    rsync -avz \
        -e "ssh $SSH_OPTS" \
        "${SCRIPT_DIR}/docker-compose.prod.yml" \
        "${SCRIPT_DIR}/nginx/" \
        "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

    # Ensure nginx directory structure exists
    $SSH_CMD "mkdir -p ${DEPLOY_PATH}/nginx/logs ${DEPLOY_PATH}/nginx/ssl"

    success "Config files synced"
}

# Check if .env.production exists on remote
check_env() {
    if ! $SSH_CMD "[ -f ${DEPLOY_PATH}/.env.production ]" 2>/dev/null; then
        warn ".env.production not found on remote server"
        echo ""
        echo "You need to create .env.production on the server:"
        echo "  1. SSH into the server: ssh ${DEPLOY_USER}@${DEPLOY_HOST}"
        echo "  2. Create the file: nano ${DEPLOY_PATH}/.env.production"
        echo "  3. Copy contents from .env.example and fill in your values"
        echo ""
        read -p "Press Enter once .env.production is configured, or Ctrl+C to abort..."

        if ! $SSH_CMD "[ -f ${DEPLOY_PATH}/.env.production ]" 2>/dev/null; then
            error ".env.production still not found. Aborting."
            exit 1
        fi
    fi
    success ".env.production found on remote"
}

# Sync .env.production to remote
sync_env() {
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
        "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env.production"

    success ".env.production synced to remote"

    # Show a preview of key settings (without secrets)
    echo ""
    log "Key settings on remote:"
    $SSH_CMD "grep -E '^(NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_AUTH_)' ${DEPLOY_PATH}/.env.production 2>/dev/null || true"
}

# Start containers on remote
start_containers() {
    log "Starting containers on remote..."

    $SSH_CMD bash << EOF
set -e
cd ${DEPLOY_PATH}

echo "Stopping old containers..."
docker compose -f docker-compose.prod.yml down --timeout 30 || true

echo "Starting containers..."
docker compose -f docker-compose.prod.yml up -d

echo "Waiting for app to be healthy..."
sleep 5

echo "Cleaning up old images..."
docker image prune -f

echo ""
echo "Container status:"
docker compose -f docker-compose.prod.yml ps
EOF

    success "Deployment complete!"
    echo ""
    log "Your app should be available at: http://${DEPLOY_HOST}"
}

# Quick restart (no rebuild)
quick_restart() {
    log "Restarting containers..."

    $SSH_CMD bash << EOF
set -e
cd ${DEPLOY_PATH}
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml ps
EOF

    success "Services restarted"
}

# Show logs from remote
show_logs() {
    local service="${1:-}"
    log "Fetching logs..."

    if [[ -n "$service" ]]; then
        $SSH_CMD "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml logs -f --tail=100 $service"
    else
        $SSH_CMD "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml logs -f --tail=50"
    fi
}

# Show status
show_status() {
    log "Checking deployment status..."

    $SSH_CMD bash << EOF
cd ${DEPLOY_PATH}
echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps
echo ""
echo "=== Resource Usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
echo ""
echo "=== Health Check ==="
curl -s http://localhost/api/health 2>/dev/null || curl -s http://localhost:3050/api/health 2>/dev/null || echo "Health endpoint not responding"
EOF
}

# Check if this is first deployment
check_first_deploy() {
    if $SSH_CMD "[ -d ${DEPLOY_PATH} ]" 2>/dev/null; then
        return 1  # Not first deploy
    else
        return 0  # First deploy
    fi
}

# Print usage
usage() {
    cat << EOF
Usage: ./scripts/deploy.sh [command]

Commands:
  deploy        Full deployment (build locally, push, start) [default]
  deploy-remote Full deployment (build on server, faster for slow connections)
  init          First-time server setup
  build         Build image locally only
  build-remote  Build image on server only
  push          Push image to server only
  start         Start containers on server (no build/push)
  restart       Quick restart without rebuilding
  sync-env      Sync local .env.production to remote server
  sync-config   Sync docker-compose.prod.yml and nginx config
  logs          Show logs (optionally: logs <service>)
  status        Show container status
  ssh           SSH into the remote server
  help          Show this help message

Examples:
  ./scripts/deploy.sh                  # Full deploy (local build)
  ./scripts/deploy.sh deploy-remote    # Full deploy (remote build)
  ./scripts/deploy.sh sync-env         # Push .env.production to server
  ./scripts/deploy.sh logs app         # Show app logs
  ./scripts/deploy.sh logs nginx       # Show nginx logs
  ./scripts/deploy.sh status           # Check status

Configuration:
  Create .env.deploy from .env.deploy.example with your server details.

EOF
}

# Main
main() {
    local cmd="${1:-deploy}"

    case "$cmd" in
        deploy)
            log "Starting deployment to ${DEPLOY_HOST} (local build)..."
            if check_first_deploy; then
                warn "First deployment detected - running init"
                init_remote
            fi
            build_image
            push_image
            sync_config
            # Sync .env.production if it exists locally
            if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
                sync_env
            else
                check_env
            fi
            start_containers
            ;;
        deploy-remote)
            log "Starting deployment to ${DEPLOY_HOST} (remote build)..."
            if check_first_deploy; then
                warn "First deployment detected - running init"
                init_remote
            fi
            sync_source
            sync_config
            # Sync .env.production if it exists locally
            if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
                sync_env
            else
                check_env
            fi
            build_image_remote
            start_containers
            ;;
        init)
            init_remote
            sync_config
            echo ""
            warn "Next step: Create .env.production on the server"
            echo "  1. SSH: ssh ${DEPLOY_USER}@${DEPLOY_HOST}"
            echo "  2. Edit: nano ${DEPLOY_PATH}/.env.production"
            echo "  3. Then run: ./scripts/deploy.sh deploy"
            ;;
        build)
            build_image
            ;;
        build-remote)
            sync_source
            build_image_remote
            ;;
        push)
            push_image
            sync_config
            ;;
        start)
            check_env
            start_containers
            ;;
        restart)
            quick_restart
            ;;
        sync-env)
            sync_env
            ;;
        sync-config)
            sync_config
            ;;
        logs)
            show_logs "${2:-}"
            ;;
        status)
            show_status
            ;;
        ssh)
            log "Connecting to ${DEPLOY_HOST}..."
            $SSH_CMD -t "cd ${DEPLOY_PATH} 2>/dev/null || true; bash"
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            error "Unknown command: $cmd"
            usage
            exit 1
            ;;
    esac
}

main "$@"
