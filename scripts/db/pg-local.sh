#!/usr/bin/env bash
# Manage the user-space PostgreSQL 17 install (D-30). Override PGHOME / PGDATA if installed elsewhere.
set -euo pipefail
PGHOME="${PGHOME:-$HOME/.local/pgsql17}"
PGDATA="${PGDATA:-$HOME/.local/var/pgdata17}"
LOG="${PGLOG:-$HOME/.local/var/pg17.log}"
case "${1:-status}" in
  start)  "$PGHOME/bin/pg_ctl" -D "$PGDATA" -l "$LOG" -o "-p 5432 -k /tmp" start ;;
  stop)   "$PGHOME/bin/pg_ctl" -D "$PGDATA" stop ;;
  status) "$PGHOME/bin/pg_ctl" -D "$PGDATA" status ;;
  psql)   shift; "$PGHOME/bin/psql" -h localhost -U firehouse -d firehouse_dev "$@" ;;
  *) echo "usage: $0 {start|stop|status|psql}"; exit 1 ;;
esac
