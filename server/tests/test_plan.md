# Server test plan

This project currently has no pytest configuration, so we will start with **Django's built-in test runner**.

## How tests are run

From the repo root (recommended: **test settings** so SQLite and `ALLOWED_HOSTS` match the Django test client, independent of `.env`):

```bash
cd server
.venv/bin/python manage.py test tests --settings=config.settings_test
```

Run a subset (examples):

```bash
cd server
.venv/bin/python manage.py test tests.test_health --settings=config.settings_test
.venv/bin/python manage.py test tests.api.test_auth --settings=config.settings_test
```

Notes:

- `config.settings_test` forces SQLite (`:memory:`), `DEBUG=False`, drops debug toolbar from apps/middleware, and extends `ALLOWED_HOSTS` for `testserver`.
- For deterministic results, tests should not rely on external services.

Shared helpers live in `tests/base.py`

## Tests directory layout

All server tests live under `server/tests/` as a single top-level test package. We’ll organize by domain to mirror the API/modules:

```
server/tests/
  __init__.py
  test_plan.md

  base.py                     # shared helpers

  test_health.py              # basic sanity checks

  api/
    __init__.py
    test_auth.py              # /api/auth/* endpoints
    test_collectives.py       # /api/collectives/* endpoints
    test_memberships.py       # /api/collective-memberships/* endpoints
    test_users.py             # /api/users/* endpoints

  permissions/
    __init__.py
    test_collective_permissions.py
    test_user_permissions.py
```

Guidelines:

- Prefer **black-box API tests** (HTTP requests) for endpoint behavior.
- Add **unit tests** for pure permission/builder logic (fast, isolated).
- Keep test names and file names explicit: `test_<topic>.py`.

## Initial tests

### 1) Health/smoke — `tests/test_health.py`

- OpenAPI JSON responds with a valid document.
- `GET /api/collectives/` is not a 5xx.

### 2) Auth API — `tests/api/test_auth.py`

- Login returns `access` / `refresh`.
- Invalid password → 401.
- `GET /api/users/my/profile` → 401 without token; 200 with expected fields when authenticated.

### 3) Collectives API — `tests/api/test_collectives.py`

- Create requires auth; verified user gets `slug` and admin `members` row; unverified email → 403.
- Anonymous list: public collectives only (unlisted member-only omitted); member sees their unlisted collective.
- Invalid visibility → 400; unknown slug detail → 404; duplicate slug at DB level → `IntegrityError`.

### 4) Memberships API — `tests/api/test_memberships.py`

- Open admission → join is `active`; application admission → `pending`.
- Second join → 400; member may `DELETE` own membership; outsider cannot delete another’s membership.
- Member cannot `PUT` another user’s role; admin can approve `pending` → `active`.

### 5) Users API — `tests/api/test_users.py`

- Unknown username → 404.
- Authenticated viewer sees `mutual_collectives` including a shared collective when both have active memberships.

### 6) Permission units — `tests/permissions/`

- `test_collective_permissions.py`: anonymous visible collectives; non-member sees no members; pending sees only self; admin/mod/member manage flags.
- `test_user_permissions.py`: `mutual_collectives_with_user` empty without viewer; shared active membership returns the collective.

## Definition of done for the first iteration

- `server/tests/` exists and tests run in CI/dev with `manage.py test tests --settings=config.settings_test`.
- First batch focuses on **critical authentication and visibility** behavior.
- Tests are deterministic and don’t require external services.
