#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install dependencies (uses cache from container state)
npm install

# Create .env.local if it doesn't exist (dev mode works without external services)
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
fi
