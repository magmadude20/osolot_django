#!/usr/bin/env bash
set -euo pipefail

# Synchronizes the full stack with latest changes.
# Note: AI-generated, I'm not familiar with bash scripting, but it seems reasonable.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"
PY="${PY:-$SERVER/.venv/bin/python}"

if [[ ! -x "$PY" ]]; then
  echo "Python venv not found at $SERVER/.venv; set PY= to your python." >&2
  exit 1
fi

echo "==> Exporting OpenAPI schema"
cd "$SERVER"
"$PY" manage.py export_openapi_schema \
  --api osolot_server.api.api \
  --output "$ROOT/api/openapi.json" \
  --indent 2

echo "==> Applying database migrations"
"$PY" manage.py migrate

echo "==> Running Orval (npm run codegen)"
cd "$CLIENT"
npm run codegen

echo "==> Done."
