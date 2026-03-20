.PHONY: \
	help \
	install dev dev-port build-local start-local lint typecheck \
	build up down logs restart clean rebuild health test sync-env-local \
	prod-up prod-down prod-logs prod-restart prod-rebuild \
	deploy deploy-remote deploy-init deploy-build deploy-push deploy-start \
	deploy-restart deploy-migrate deploy-sync-env deploy-sync-config deploy-logs deploy-status deploy-ssh \
	shell nginx-shell nginx-test ps stats backup-env \
	migrate migrate-status migrate-force

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "Local (non-Docker) commands:"
	@echo "  make install      - Install dependencies (pnpm)"
	@echo "  make dev          - Start Next.js dev server (auto-picks a free port)"
	@echo "  make dev-port PORT=3050 - Start dev server on a specific port"
	@echo "  make lint         - Run eslint"
	@echo "  make typecheck    - Run TypeScript typecheck"
	@echo "  make build-local  - Build Next.js"
	@echo "  make start-local  - Start Next.js (requires build)"
	@echo ""
	@echo "Local Docker commands (uses .env):"
	@echo "  make build        - Build Docker images"
	@echo "  make up           - Start containers"
	@echo "  make down         - Stop containers"
	@echo "  make logs         - View logs"
	@echo "  make restart      - Restart containers"
	@echo "  make rebuild      - Rebuild and restart"
	@echo "  make clean        - Remove containers and images"
	@echo "  make health       - Check application health"
	@echo "  make test         - Run tests"
	@echo "  make sync-env-local - Copy .env.production to .env for local Docker"
	@echo ""
	@echo "Database Migration commands:"
	@echo "  make migrate              - Run all pending migrations"
	@echo "  make migrate-status       - Show migration status"
	@echo "  make migrate-force NAME=  - Force re-run a migration"
	@echo ""
	@echo "Remote Deployment commands (htzweb01vm01 via Tailscale):"
	@echo "  make deploy             - Full deploy: sync env, pull, build, start"
	@echo "  make deploy-build       - Build image on server"
	@echo "  make deploy-restart     - Quick restart without rebuilding"
	@echo "  make deploy-sync-env    - Sync .env.production to server"
	@echo "  make deploy-logs        - View remote logs (SERVICE=app)"
	@echo "  make deploy-status      - Check remote container status + health"
	@echo "  make deploy-ssh         - SSH into the remote server"

# Local (non-Docker) commands
install:
	pnpm install

dev:
	pnpm dev

dev-port:
	@if [ -z "$(PORT)" ]; then \
		echo "Error: Please specify PORT=<port>"; \
		echo "Example: make dev-port PORT=3050"; \
		exit 1; \
	fi
	DEV_PORT=$(PORT) pnpm dev

lint:
	pnpm lint

typecheck:
	npx tsc --noEmit

build-local:
	pnpm build

start-local:
	pnpm start

# Development/Staging commands
build:
	docker-compose build

up:
	docker-compose up -d
	@echo "Application started at http://localhost:3050"
	@echo "Health check: http://localhost:3050/api/health"

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

rebuild:
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo "Application rebuilt and restarted"

clean:
	docker-compose down -v
	docker rmi supabase-access-broker-app 2>/dev/null || true
	@echo "Cleaned up containers and images"

health:
	@curl -f http://localhost:3050/api/health || echo "Health check failed"

test:
	docker-compose exec app pnpm test

# Production commands
prod-up:
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production stack started"
	@echo "HTTP: http://localhost"
	@echo "Health check: http://localhost/health"

prod-down:
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-restart:
	docker-compose -f docker-compose.prod.yml restart

prod-rebuild:
	docker-compose -f docker-compose.prod.yml down
	docker-compose -f docker-compose.prod.yml build --no-cache
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production stack rebuilt and restarted"

# Remote Deployment commands (htzweb01vm01 via Tailscale)
DEPLOY_HOST := root@100.80.250.15
DEPLOY_DIR := /opt/apps/access

deploy:
	@echo "==> Syncing .env.production to server..."
	scp .env.production $(DEPLOY_HOST):$(DEPLOY_DIR)/.env
	ssh $(DEPLOY_HOST) "chmod 600 $(DEPLOY_DIR)/.env && chown deploy:deploy $(DEPLOY_DIR)/.env"
	@echo "==> Pulling latest code..."
	ssh $(DEPLOY_HOST) "sudo -u deploy bash -c 'cd $(DEPLOY_DIR) && git pull origin main'"
	@echo "==> Building and deploying..."
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d"
	@echo "==> Reloading Caddy..."
	ssh $(DEPLOY_HOST) "systemctl reload caddy"
	@echo "==> Deploy complete! https://access.matthew.systems"

deploy-build:
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml build"

deploy-restart:
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml restart"

deploy-sync-env:
	scp .env.production $(DEPLOY_HOST):$(DEPLOY_DIR)/.env
	ssh $(DEPLOY_HOST) "chmod 600 $(DEPLOY_DIR)/.env && chown deploy:deploy $(DEPLOY_DIR)/.env"
	@echo "==> .env synced to server"

deploy-logs:
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml logs -f $(SERVICE)"

deploy-status:
	ssh $(DEPLOY_HOST) "cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml ps && echo '---' && curl -s http://127.0.0.1:3050/api/health | jq ."

deploy-ssh:
	ssh $(DEPLOY_HOST)

# Sync .env.production to .env for local Docker testing
sync-env-local:
	@if [ -f .env.production ]; then \
		cp .env.production .env; \
		echo "Copied .env.production to .env"; \
	else \
		echo "Error: .env.production not found"; \
		exit 1; \
	fi

# Utility commands
shell:
	docker-compose exec app sh

nginx-shell:
	docker-compose -f docker-compose.prod.yml exec nginx sh

nginx-test:
	docker run --rm -v $$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx nginx -t

ps:
	docker-compose ps

stats:
	docker stats supabase-access-broker

backup-env:
	cp .env.production .env.production.backup-$$(date +%Y%m%d-%H%M%S)
	@echo "Environment backed up"

# Migration commands
migrate:
	@echo "Running database migrations..."
	pnpm migrate

migrate-status:
	@echo "Checking migration status..."
	pnpm migrate:status

migrate-force:
	@if [ -z "$(NAME)" ]; then \
		echo "Error: Please specify NAME=<migration-name>"; \
		echo "Example: make migrate-force NAME=001_multi_app_support"; \
		exit 1; \
	fi
	@echo "Force re-running migration: $(NAME)"
	pnpm migrate:force $(NAME)
