# Osolot

Osolot is a full-stack app for **collectives** (groups with visibility, admission rules, and memberships). The **server** is a Django project exposing a **Django Ninja** REST API under `/api/`, with **JWT** (SimpleJWT) for authenticated routes. The **client** is a small React SPA (Vite) that talks to that API; the OpenAPI spec is exported from Django and used to generate TypeScript clients.

---

## Repository layout (top level)

| Path | Purpose |
| ------ | --------- |
| `server/` | Django backend, Python dependencies, and project configuration. |
| `client/` | React + Vite frontend; API types and hooks are generated (Orval) from the shared OpenAPI file. |
| `api/` | `openapi.json` — exported schema used for client codegen (`scripts/update_stack.sh`). |
| `scripts/` | `update_stack.sh` (export schema, migrate, codegen), `run_stack.sh` (dev: update stack, then Django + Vite). |
| `.github/workflows/` | CI (e.g. tests and builds). |

---

## `client/` (brief)

Vite + React Router. Pages cover auth, home/profile, collectives list/detail, membership flows, and password/email verification. Generated API surface lives under `src/api/`; do not hand-edit `generated.ts` — regenerate from `api/openapi.json` after server schema changes.

---

## `server/` — per directory

### `server/config/`

Django **project** package (not an app): `settings.py`, root `urls.py` (`/admin/`, `/api/` → Ninja API), `wsgi.py`, `asgi.py`. Environment is loaded from `server/.env` (see `.env.example` in the same folder).

### `server/manage.py`

Django CLI entrypoint; `DJANGO_SETTINGS_MODULE` defaults to `config.settings`.

### `server/requirements.txt`

Pinned Python dependencies for the server virtualenv.

### `server/.env.example`

Template for secrets and toggles (e.g. `DJANGO_SECRET_KEY`, DB URL, email-related settings).

### `server/auth/`

Standalone Python package (not listed in `INSTALLED_APPS`). Holds **custom authentication backends** (e.g. email-or-username login) referenced from `AUTHENTICATION_BACKENDS` in settings.

### `server/osolot_server/`

Main **Django app** (`osolot_server`): models, admin, API routers, security helpers, and migrations.

- **`osolot_server/models/`** — ORM models.
- **`osolot_server/migrations/`** — Database migrations.
- **`osolot_server/api/`** — **Django Ninja** API: functionality divided by category (collectives, memberships, etc.).
- **`osolot_server/api_builders/`** — Pure helpers that assemble **response payloads** from models. Includes managing field visiblity for a given viewer, often using functions in the `../permissions` directory.
- **`osolot_server/permissions/`** — **Authorization / visibility** rules (e.g. who can see a collective), kept separate from HTTP handlers.
- **`osolot_server/email/`** — Outbound **email** helpers (e.g. password reset, verification, etc.), decoupled from route handlers.

---

## Useful commands

- **Sync changes across django/database/client**: `scripts/update_stack.sh`.
- **Start full dev stack**: `scripts/run_stack.sh` runs stack update, then starts dev server (port 8000) + client (port 5173).
- **Django**: from `server/`, use `.venv/bin/python manage.py` (`makemigrations`, `createsuperuser`, etc.). `runserver`, `migrate`, etc. is generally run by way of `update_stack.py`
