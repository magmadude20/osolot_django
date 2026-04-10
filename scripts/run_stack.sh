#!/usr/bin/env bash
set -euo pipefail

# Runs update_stack.sh, then starts the API and web client together.
# Ctrl+C stops both processes.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"
PY="${PY:-$SERVER/.venv/bin/python}"

"$ROOT/scripts/update_stack.sh"

if [[ ! -x "$PY" ]]; then
  echo "Python venv not found at $SERVER/.venv; set PY= to your python." >&2
  exit 1
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Starting Django (manage.py runserver)"
(
  cd "$SERVER"
  exec "$PY" manage.py runserver
) &
SERVER_PID=$!

echo "==> Starting Vite (npm run dev)"
(
  cd "$CLIENT"
  exec npm run dev
) &
CLIENT_PID=$!

wait "$SERVER_PID" "$CLIENT_PID"
