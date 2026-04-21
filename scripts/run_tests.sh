#!/usr/bin/env bash
set -euo pipefail

# Run Django server tests (SQLite test settings, no .env DB required).
#
# Examples:
#   ./scripts/run_tests.sh
#   ./scripts/run_tests.sh tests.api.test_auth
#   ./scripts/run_tests.sh tests.test_health tests.permissions.test_user_permissions -v 2

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/server"
PY="${PY:-$SERVER/.venv/bin/python}"

if [[ ! -x "$PY" ]]; then
  echo "Python venv not found at $SERVER/.venv; set PY= to your python." >&2
  exit 1
fi

cd "$SERVER"
echo "==> Running Django tests (config.settings_test)"
if [[ $# -eq 0 ]]; then
  exec "$PY" manage.py test tests --settings=config.settings_test
else
  exec "$PY" manage.py test --settings=config.settings_test "$@"
fi
