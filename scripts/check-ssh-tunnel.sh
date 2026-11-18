#!/bin/bash
# Keep-alive for the Health RAG public tunnel (localhost.run over SSH via the egress proxy).
# Versioned source: repo/scripts/check-ssh-tunnel.sh — live copy run by the
# cron job is ~/workspace/health-rag/check-ssh-tunnel.sh (keep them in sync).
# Restarts the SSH tunnel if the process died or the public /health stops responding.
# NOTE: localhost.run rotates the free subdomain on reconnect — the current URL is
# recorded in ~/workspace/health-rag/tunnel-url.txt AND published instantly to a
# public gist (health-rag-backend-url.json) so the APK can find the server
# itself without anyone pasting a URL. The website also serves the same JSON
# at /api-url.json (see repo/web/scripts/write-api-url.js, run by prebuild).
# Long-term fix: a custom domain at admin.localhost.run, or the Render
# backend (see backend/README.md).
#
# Flap guard: a single slow /health response must NOT restart the tunnel.
# Health is checked with a 30s timeout and the tunnel only restarts after
# 2 consecutive failures (~5s apart), or when the SSH process is dead.
cd ~/workspace/health-rag
URL_FILE=~/workspace/health-rag/tunnel-url.txt
GIST_ID_FILE=~/workspace/health-rag/gist-id.txt
JSON_FILE=~/workspace/health-rag/health-rag-backend-url.json
URL=$(cat "$URL_FILE" 2>/dev/null)

health_ok() {
  [ -n "$URL" ] && curl -sf -m 30 "$URL/health" >/dev/null 2>&1
}

# Publish the current URL to the public gist so clients can resolve it.
# Uses `gh gist edit` with a local file (non-interactive replace).
publish_gist() {
  local new_url="$1"
  printf '{"url": "%s"}' "$new_url" > "$JSON_FILE"
  if [ -f "$GIST_ID_FILE" ]; then
    local gist_id
    gist_id=$(cat "$GIST_ID_FILE")
    if gh gist edit "$gist_id" --filename health-rag-backend-url.json "$JSON_FILE" >/dev/null 2>&1; then
      echo "$(date -Iseconds) gist updated: $new_url" >> tunnel-keepalive.log
    else
      echo "$(date -Iseconds) gist update FAILED for $new_url" >> tunnel-keepalive.log
    fi
  else
    echo "$(date -Iseconds) gist update skipped (no gist-id.txt)" >> tunnel-keepalive.log
  fi
}

SSH_ALIVE=0
if [ -f ssh-tunnel.pid ] && kill -0 "$(cat ssh-tunnel.pid)" 2>/dev/null; then
  SSH_ALIVE=1
fi

if [ "$SSH_ALIVE" = "1" ]; then
  if health_ok; then
    exit 0
  fi
  # First failure — could be one slow response. Wait and check again.
  sleep 5
  if health_ok; then
    exit 0
  fi
  echo "$(date -Iseconds) health failed twice in a row, restarting tunnel" >> tunnel-keepalive.log
else
  echo "$(date -Iseconds) ssh tunnel process dead, restarting" >> tunnel-keepalive.log
fi

# restart (SSH mechanism unchanged — ProxyCommand via proxy_connect.py)
[ -f ssh-tunnel.pid ] && kill "$(cat ssh-tunnel.pid)" 2>/dev/null
sleep 2
nohup ssh -i ~/.ssh/localhost_run -o StrictHostKeyChecking=accept-new \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  -o ProxyCommand="python3 /home/hatch/workspace/health-rag/proxy_connect.py %h %p" \
  -R 80:127.0.0.1:8000 ssh.localhost.run > ssh-tunnel.log 2>&1 &
echo $! > ssh-tunnel.pid
sleep 35
NEW_URL=$(grep -o 'https://[a-z0-9]*\.app\.lhr\.life' ssh-tunnel.log | head -1)
if [ -n "$NEW_URL" ]; then
  echo "$NEW_URL" > "$URL_FILE"
  echo "$(date -Iseconds) tunnel restarted, new URL: $NEW_URL" >> tunnel-keepalive.log
  publish_gist "$NEW_URL"
else
  echo "$(date -Iseconds) tunnel restarted, URL not found in log" >> tunnel-keepalive.log
fi
