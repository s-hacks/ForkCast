#!/usr/bin/env bash
# Manage the user-space PostgreSQL 17 install (D-30). Override PGHOME / PGDATA if installed elsewhere.
set -euo pipefail
PGHOME="${PGHOME:-$HOME/.local/pgsql17}"
PGDATA="${PGDATA:-$HOME/.local/var/pgdata17}"
LOG="${PGLOG:-$HOME/.local/var/pg17.log}"
PGCTL="$PGHOME/bin/pg_ctl"

is_running() { "$PGCTL" -D "$PGDATA" status >/dev/null 2>&1; }

case "${1:-status}" in
  start)
    if is_running; then
      echo "PostgreSQL already running (data: $PGDATA)."
    else
      # Remove a stale lock file left by a crash; pg_ctl status already confirmed no live postmaster.
      rm -f "$PGDATA/postmaster.pid"
      "$PGCTL" -D "$PGDATA" -l "$LOG" -w -o "-p 5432 -k /tmp" start
    fi
    ;;
  stop)   is_running && "$PGCTL" -D "$PGDATA" -m fast stop || echo "PostgreSQL is not running." ;;
  status) "$PGCTL" -D "$PGDATA" status || true ;;
  psql)   shift; "$PGHOME/bin/psql" -h localhost -U firehouse -d firehouse_dev "$@" ;;
  *) echo "usage: $0 {start|stop|status|psql}"; exit 1 ;;
esac
