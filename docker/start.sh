#!/bin/bash
set -e

echo "🖍️  Chalk — Starting up..."

# ─── Run database migrations ───────────────────────────
echo "📦 Running database migrations..."
node /app/packages/shared/dist/db/migrate.js 2>&1 || {
  echo "⚠️  Migration failed or already applied, continuing..."
}

# ─── Start the worker in background ────────────────────
echo "⚙️  Starting ingestion worker..."
node packages/worker/dist/index.js &
WORKER_PID=$!

# ─── Start the backend (foreground) ────────────────────
echo "🚀 Starting API server..."
node packages/backend/dist/index.js &
BACKEND_PID=$!

echo "🖍️  Chalk is running!"
echo "   Backend:  http://localhost:${PORT:-3001}"
echo "   Worker:   PID $WORKER_PID"

# ─── Graceful shutdown ─────────────────────────────────
shutdown() {
  echo ""
  echo "🛑 Shutting down Chalk..."
  kill $WORKER_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  wait $WORKER_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  echo "👋 Chalk stopped."
  exit 0
}

trap shutdown INT TERM

# Wait for either process to exit
wait -n $BACKEND_PID $WORKER_PID
EXIT_CODE=$?

echo "⚠️  A process exited with code $EXIT_CODE, shutting down..."
shutdown
