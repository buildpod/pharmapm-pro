#!/usr/bin/env bash
# TRACE preflight — run at the start of every session.
#
# Checks:
#   1. v1 tests (305/305)
#   2. v2 TypeScript build
#   3. v2 Jest unit tests
#
# Usage:
#   bash scripts/preflight.sh
#
# Exit code 0 = all green.
# Exit code 1 = something failed (details printed above).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

echo "=== PharmaPM Pro — TRACE Preflight ==="
echo

# ── v1 tests ──────────────────────────────────────────────────────────────────
echo "--- v1 tests ---"
V1_OUTPUT=$(cd "$ROOT" && node tools/run_tests.js 2>&1)
V1_SUMMARY=$(echo "$V1_OUTPUT" | grep -E "[0-9]+/[0-9]+ passed" | tail -1 || true)
if echo "$V1_OUTPUT" | grep -q "305/305 passed"; then
  echo "✅  v1: $V1_SUMMARY"
  PASS=$((PASS + 1))
else
  echo "❌  v1: $V1_SUMMARY"
  echo "    Full output:"
  echo "$V1_OUTPUT" | tail -10 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi
echo

# ── v2 build (type-check + Next.js export) ────────────────────────────────────
echo "--- v2 build ---"
BUILD_OUTPUT=$(cd "$ROOT/v2" && pnpm build 2>&1)
BUILD_EXIT=$?
if [ $BUILD_EXIT -eq 0 ]; then
  BUILD_SUMMARY=$(echo "$BUILD_OUTPUT" | grep -E "Route \(app\)|compiled|Generating" | tail -3 || echo "build succeeded")
  echo "✅  v2 build: clean"
  PASS=$((PASS + 1))
else
  echo "❌  v2 build: FAILED"
  echo "$BUILD_OUTPUT" | tail -20 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi
echo

# ── v2 Jest tests ─────────────────────────────────────────────────────────────
echo "--- v2 tests ---"
TEST_OUTPUT=$(cd "$ROOT/v2" && pnpm test --passWithNoTests 2>&1)
TEST_EXIT=$?
TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "Test Files|Tests " | tail -2 || echo "(no summary)")
if [ $TEST_EXIT -eq 0 ]; then
  echo "✅  v2 tests:"
  echo "$TEST_SUMMARY" | sed 's/^/    /'
  PASS=$((PASS + 1))
else
  echo "❌  v2 tests: FAILED"
  echo "$TEST_OUTPUT" | tail -20 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi
echo

# ── Summary ───────────────────────────────────────────────────────────────────
echo "=== Preflight summary: $PASS passed, $FAIL failed ==="
if [ $FAIL -eq 0 ]; then
  echo "✅  All checks passed. Safe to start work."
  exit 0
else
  echo "❌  Fix the issues above before starting work."
  exit 1
fi
