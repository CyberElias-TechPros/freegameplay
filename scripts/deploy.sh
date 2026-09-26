#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FreeGameplay — one-command backend deployment to Cloudflare.
#
#   1. Provisions the account (D1 + R2 + KV), idempotent
#   2. Deploys the Worker
#   3. Applies D1 migrations in order (explicit, not implicit)
#   4. Sets the ADMIN_TOKEN + SITE_URL secrets (and optional ones if present)
#   5. Uploads media to R2
#   6. Seeds content through the admin import pipeline
#   7. Runs the full end-to-end verification suite
#
# Prereq: .env at the repo root (copy from .env.example) with
# CLOUDFLARE_API_TOKEN set. Everything else is generated for you.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\x1b[1;36m━━ %s ━━\x1b[0m\n' "$*"; }

[ -f .env ] || { echo "✗ Missing .env — copy .env.example to .env and set CLOUDFLARE_API_TOKEN."; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "✗ CLOUDFLARE_API_TOKEN is empty in .env"; exit 1; }

# Generate + persist the admin token if the user didn't provide one
if [ -z "${ADMIN_TOKEN:-}" ]; then
  ADMIN_TOKEN=$(openssl rand -hex 24)
  sed -i.bak 's/^ADMIN_TOKEN=.*/ADMIN_TOKEN='"$ADMIN_TOKEN"'/' .env && rm -f .env.bak
  export ADMIN_TOKEN
  echo "Generated ADMIN_TOKEN (saved to .env)"
else
  export ADMIN_TOKEN
fi

step "1/8 Install dependencies"
npm install --no-audit --no-fund

step "2/8 Provision Cloudflare resources (idempotent)"
node scripts/provision.mjs

step "3/8 Deploy Worker"
(
  cd apps/api
  npx wrangler deploy
)

step "4/8 Apply D1 migrations (in order)"
node scripts/migrate.mjs --remote

step "5/8 Set Worker secrets"
(
  cd apps/api
  printf '%s' "$ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
  printf '%s' "${SITE_URL:-https://freegameplay.site}" | npx wrangler secret put SITE_URL
  # Optional secrets — only pushed when the operator has configured them, so a
  # bare deploy never overwrites a previously-set value with an empty one.
  for pair in "ANALYTICS_SALT:${ANALYTICS_SALT:-}" "RESEND_API_KEY:${RESEND_API_KEY:-}" \
              "NOTIFY_FROM:${NOTIFY_FROM:-}" "NOTIFY_TO:${NOTIFY_TO:-}"; do
    name="${pair%%:*}"; value="${pair#*:}"
    if [ -n "$value" ]; then
      printf '%s' "$value" | npx wrangler secret put "$name"
      echo "  set $name"
    else
      echo "  skipped $name (not configured)"
    fi
  done
)

step "6/8 Upload media to R2"
node scripts/upload-media.mjs --remote

step "7/8 Seed content through the admin import pipeline"
node scripts/seed.mjs --remote

step "8/8 End-to-end verification"
node scripts/verify.mjs --remote

step "Done"
if [ -f .deploy-state.json ]; then
  echo "  Worker URL: $(node -e "console.log(require('./.deploy-state.json').workerUrl ?? 'see wrangler output above')")"
fi
echo
echo "Frontend: set API_BASE to the worker URL (see .env.example) and deploy apps/web to Vercel."
echo "Operator console: https://<your-domain>/admin (paste the ADMIN_TOKEN)."
echo "Local preview: npm run dev:api && npm run dev:web"
