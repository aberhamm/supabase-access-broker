.PHONY: \
	help \
	install dev dev-port build-local start-local lint typecheck \
	build up down logs restart clean rebuild health test \
	prod-up prod-down prod-logs prod-restart prod-rebuild \
	deploy deploy-remote deploy-init deploy-build deploy-push deploy-start \
	deploy-restart deploy-sync-env deploy-sync-config deploy-logs deploy-status deploy-ssh \
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
	@echo "Local Docker commands:"
	@echo "  make build        - Build Docker images"
	@echo "  make up           - Start containers"
	@echo "  make down         - Stop containers"
	@echo "  make logs         - View logs"
	@echo "  make restart      - Restart containers"
	@echo "  make rebuild      - Rebuild and restart"
	@echo "  make clean        - Remove containers and images"
	@echo "  make health       - Check application health"
	@echo "  make test         - Run tests"
	@echo ""
	@echo "Database Migration commands:"
	@echo "  make migrate              - Run all pending migrations"
	@echo "  make migrate-status       - Show migration status"
	@echo "  make migrate-force NAME=  - Force re-run a migration"
	@echo ""
	@echo "Remote Deployment commands (configure .env.deploy first):"
	@echo "  make deploy             - Full deploy: build locally, push, start"
	@echo "  make deploy-remote      - Full deploy: build on server (slower upload, faster build)"
	@echo "  make deploy-init        - First-time server setup"
	@echo "  make deploy-build       - Build image locally only"
	@echo "  make deploy-push        - Push image to server only"
	@echo "  make deploy-start       - Start containers on server"
	@echo "  make deploy-restart     - Quick restart without rebuilding"
	@echo "  make deploy-sync-env    - Sync .env.production to server"
	@echo "  make deploy-sync-config - Sync docker-compose and nginx config"
	@echo "  make deploy-logs        - View remote logs (SERVICE=app|nginx)"
	@echo "  make deploy-status      - Check remote container status"
	@echo "  make deploy-ssh         - SSH into the remote server"
	@echo ""
	@echo "Local Production commands:"
	@echo "  make prod-up      - Start production stack locally"
	@echo "  make prod-down    - Stop production stack locally"
	@echo "  make prod-logs    - View production logs locally"
	@echo "  make prod-restart - Restart production stack locally"

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
	docker rmi supabase-claims-admin-dashboard-app 2>/dev/null || true
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

# Remote Deployment commands
deploy:
	@./scripts/deploy.sh deploy

deploy-remote:
	@./scripts/deploy.sh deploy-remote

deploy-init:
	@./scripts/deploy.sh init

deploy-build:
	@./scripts/deploy.sh build

deploy-push:
	@./scripts/deploy.sh push

deploy-start:
	@./scripts/deploy.sh start

deploy-restart:
	@./scripts/deploy.sh restart

deploy-sync-env:
	@./scripts/deploy.sh sync-env

deploy-sync-config:
	@./scripts/deploy.sh sync-config

deploy-logs:
	@./scripts/deploy.sh logs $(SERVICE)

deploy-status:
	@./scripts/deploy.sh status

deploy-ssh:
	@./scripts/deploy.sh ssh

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
	docker stats claims-admin-dashboard

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
