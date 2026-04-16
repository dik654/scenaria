# ── Scenaria Makefile ──
# Ubuntu/macOS 공통 셋업, 빌드, 실행

SHELL := /bin/bash
NODE_MIN := 18
CLAUDE_CLI := $(shell command -v claude 2>/dev/null)

# ── 기본 타겟 ──

.PHONY: all setup deps claude-cli claude-login build dev run clean check-node check-claude

all: setup build

# ── 환경 체크 ──

check-node:
	@node -v >/dev/null 2>&1 || { echo "❌ Node.js가 설치되어 있지 않습니다. v$(NODE_MIN)+ 필요"; exit 1; }
	@NODE_VER=$$(node -v | sed 's/v//' | cut -d. -f1); \
	if [ "$$NODE_VER" -lt $(NODE_MIN) ]; then \
		echo "❌ Node.js v$(NODE_MIN)+ 필요 (현재: $$(node -v))"; exit 1; \
	fi
	@echo "✅ Node.js $$(node -v)"

check-claude:
	@if [ -z "$(CLAUDE_CLI)" ]; then \
		echo "❌ Claude Code CLI가 설치되어 있지 않습니다"; \
		echo "   → make claude-cli 로 설치하세요"; \
		exit 1; \
	fi
	@echo "✅ Claude Code $$(claude --version)"
	@AUTH=$$(claude auth status 2>&1); \
	if echo "$$AUTH" | grep -q '"loggedIn": true'; then \
		EMAIL=$$(echo "$$AUTH" | grep -o '"email": "[^"]*"' | head -1 | cut -d'"' -f4); \
		SUB=$$(echo "$$AUTH" | grep -o '"subscriptionType": "[^"]*"' | head -1 | cut -d'"' -f4); \
		echo "✅ 로그인됨: $$EMAIL ($$SUB)"; \
	else \
		echo "❌ Claude Code 로그인 필요"; \
		echo "   → make claude-login 으로 로그인하세요"; \
		exit 1; \
	fi

# ── 셋업 ──

setup: check-node deps claude-cli claude-login
	@echo ""
	@echo "🎬 Scenaria 셋업 완료!"

deps: check-node
	@echo "📦 프로젝트 의존성 설치..."
	npm install

claude-cli: check-node
	@if [ -z "$(CLAUDE_CLI)" ]; then \
		echo "📥 Claude Code CLI 전역 설치..."; \
		npm install -g @anthropic-ai/claude-code; \
	else \
		echo "✅ Claude Code CLI 이미 설치됨 ($$(claude --version))"; \
	fi

claude-login:
	@AUTH=$$(claude auth status 2>&1); \
	if echo "$$AUTH" | grep -q '"loggedIn": true'; then \
		EMAIL=$$(echo "$$AUTH" | grep -o '"email": "[^"]*"' | head -1 | cut -d'"' -f4); \
		echo "✅ 이미 로그인됨: $$EMAIL"; \
	else \
		echo "🔑 Claude Code 로그인을 시작합니다..."; \
		claude login; \
	fi

# ── 빌드 ──

build: deps
	@echo "🔨 프로덕션 빌드..."
	npm run build:electron

build-web: deps
	@echo "🔨 웹 빌드..."
	npm run build

# ── 실행 ──

dev:
	npm run dev:electron

dev-web:
	npm run dev

run: build
	@echo "🚀 Scenaria 실행..."
	npx electron out/main/main.js

# ── 패키징 ──

package: deps
	@echo "📦 Electron 패키징..."
	npm run package

# ── 상태 확인 ──

status: check-node
	@echo ""
	@echo "── Scenaria 환경 상태 ──"
	@echo "Node.js: $$(node -v)"
	@echo "npm: $$(npm -v)"
	@if [ -n "$(CLAUDE_CLI)" ]; then \
		echo "Claude Code: $$(claude --version)"; \
		AUTH=$$(claude auth status 2>&1); \
		if echo "$$AUTH" | grep -q '"loggedIn": true'; then \
			EMAIL=$$(echo "$$AUTH" | grep -o '"email": "[^"]*"' | head -1 | cut -d'"' -f4); \
			SUB=$$(echo "$$AUTH" | grep -o '"subscriptionType": "[^"]*"' | head -1 | cut -d'"' -f4); \
			echo "계정: $$EMAIL ($$SUB)"; \
		else \
			echo "계정: 로그인 안됨"; \
		fi; \
	else \
		echo "Claude Code: 미설치"; \
	fi
	@echo ""

# ── 정리 ──

clean:
	rm -rf dist out node_modules/.vite
