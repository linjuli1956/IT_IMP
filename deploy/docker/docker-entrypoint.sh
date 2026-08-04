#!/bin/sh
set -e

cd /app/web

read_required_secret() {
  secret_file="$1"
  secret_name="$2"
  if [ -z "$secret_file" ] || [ ! -f "$secret_file" ]; then
    echo "[entrypoint] ERROR: Docker Secret $secret_name is missing."
    exit 1
  fi
  cat "$secret_file"
}

export DATABASE_PASSWORD="$(read_required_secret "${DATABASE_PASSWORD_FILE:-}" "DATABASE_PASSWORD")"
export JWT_SECRET="$(read_required_secret "${JWT_SECRET_FILE:-}" "JWT_SECRET")"
export DATABASE_URL="mysql://${DATABASE_USER}:$(node -p 'encodeURIComponent(process.env.DATABASE_PASSWORD)')@${DATABASE_HOST}:${DATABASE_PORT:-3306}/${DATABASE_NAME}"

echo "[entrypoint] IT_IMP web service starting"
echo "[entrypoint] Waiting for MySQL at ${DATABASE_HOST}:${DATABASE_PORT}..."

READY=0
for i in $(seq 1 30); do
  if node -e '
    const mariadb = require("mariadb");
    (async () => {
      let connection;
      try {
        connection = await mariadb.createConnection({
          host: process.env.DATABASE_HOST,
          port: Number(process.env.DATABASE_PORT || 3306),
          user: process.env.DATABASE_USER,
          password: process.env.DATABASE_PASSWORD,
        });
        process.exit(0);
      } catch (error) {
        process.exit(1);
      } finally {
        if (connection) await connection.end();
      }
    })();
  ' 2>/dev/null; then
    READY=1
    echo "[entrypoint] MySQL is ready."
    break
  fi

  echo "[entrypoint] MySQL not ready, retry $i/30..."
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "[entrypoint] ERROR: MySQL failed to become ready within 60s."
  exit 1
fi

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Creating initial administrator when no users exist..."
node scripts/bootstrap-admin.mjs

echo "[entrypoint] Starting web server on port ${PORT:-3000}..."
exec node .output/server/index.mjs
