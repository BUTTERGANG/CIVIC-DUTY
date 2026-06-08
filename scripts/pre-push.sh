#!/usr/bin/env bash
# pre-push.sh — Fast local checks before pushing to avoid CI failures.
# Usage: ./scripts/pre-push.sh
#        or: cp scripts/pre-push.sh .git/hooks/pre-push

set -euo pipefail
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0

# --- Backend typecheck ---
echo -e "${YELLOW}[1/4]${NC} TypeScript typecheck..."
if npx tsc --noEmit 2>&1; then
  echo -e "${GREEN}  ✓ Typecheck clean${NC}"
else
  echo -e "${RED}  ✗ TypeScript errors${NC}"
  ((FAILURES++))
fi

# --- Backend build ---
echo -e "${YELLOW}[2/4]${NC} Backend build (tsc)..."
if npm run build 2>&1; then
  if [ -f dist/server.js ]; then
    echo -e "${GREEN}  ✓ Backend builds${NC}"
  else
    echo -e "${RED}  ✗ dist/server.js missing after build${NC}"
    ((FAILURES++))
  fi
else
  echo -e "${RED}  ✗ Backend build failed${NC}"
  ((FAILURES++))
fi

# --- Frontend build ---
echo -e "${YELLOW}[3/4]${NC} Frontend build (vite)..."
if (cd CIVIC-DUTY-UI && npm run build 2>&1); then
  if [ -f CIVIC-DUTY-UI/dist/index.html ]; then
    echo -e "${GREEN}  ✓ Frontend builds${NC}"
  else
    echo -e "${RED}  ✗ CIVIC-DUTY-UI/dist/index.html missing after build${NC}"
    ((FAILURES++))
  fi
else
  echo -e "${RED}  ✗ Frontend build failed${NC}"
  ((FAILURES++))
fi

# --- Frontend lint ---
echo -e "${YELLOW}[4/4]${NC} ESLint..."
if (cd CIVIC-DUTY-UI && npm run lint 2>&1); then
  echo -e "${GREEN}  ✓ ESLint clean${NC}"
else
  echo -e "${RED}  ✗ ESLint found issues${NC}"
  ((FAILURES++))
fi

# --- Summary ---
echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}All checks passed. Safe to push!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES check(s) failed.${NC}"
  read -rp "Push anyway? [y/N] " CONFIRM
  if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Pushing with failures...${NC}"
    exit 0
  else
    echo "Push aborted."
    exit 1
  fi
fi
