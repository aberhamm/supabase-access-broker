.PHONY: help build up down logs restart clean rebuild health test prod-up prod-down prod-logs

# Default target
help:
	@echo "Available commands:"
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
	@echo "Production commands:"
	@echo "  make prod-up      - Start production stack"
	@echo "  make prod-down    - Stop production stack"
	@echo "  make prod-logs    - View production logs"
	@echo "  make prod-restart - Restart production stack"

# Development/Staging commands
build:
	docker-compose build

up:
	docker-compose up -d
	@echo "Application started at http://localhost:3000"
	@echo "Health check: http://localhost:3000/api/health"

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
	@curl -f http://localhost:3000/api/health || echo "Health check failed"

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


