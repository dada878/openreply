#!/bin/sh
set -eu

# Zeabur's prebuilt service command runs `npm run start` directly, so keep the
# migration, web server, worker, and cron scheduler in the command it actually
# executes instead of relying on a Docker CMD override.
npm run db:migrate
next start &
web_pid=$!
npm run worker &
worker_pid=$!
CRON_BASE_URL=http://127.0.0.1:3000 sh scripts/cron.sh &
cron_pid=$!
trap 'kill "$web_pid" "$worker_pid" "$cron_pid" 2>/dev/null || true; exit 0' TERM INT
while kill -0 "$web_pid" && kill -0 "$worker_pid" && kill -0 "$cron_pid"; do sleep 5; done
kill "$web_pid" "$worker_pid" "$cron_pid" 2>/dev/null || true
exit 1
