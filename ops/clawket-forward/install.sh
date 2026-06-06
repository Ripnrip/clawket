#!/usr/bin/env bash
#
# install.sh — deploy the Clawket bridge forwarder on the agent-habitat VM.
#
# WHY: the Clawket mobile app's baked-in endpoint is
#   agent-habitat.tail48d4cc.ts.net:4319
# but the bridge process actually runs on the studio host
# (admins-mac-studio / 100.89.167.39:4319), because the bridge needs the
# Hermes API which is bound loopback-only on studio. This forwarder makes the
# app's existing URL reach the real bridge with no app rebuild.
#
# Run this ON the agent-habitat VM (e.g. ssh admin@agent-habitat.local).
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.binarybros.clawket-forward"
SCRIPT_DST="$HOME/clawket-bridge-forward.py"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "==> Installing forwarder script -> $SCRIPT_DST"
install -m 0644 "$SRC_DIR/clawket-bridge-forward.py" "$SCRIPT_DST"

echo "==> Installing LaunchAgent -> $PLIST_DST"
mkdir -p "$HOME/Library/LaunchAgents"
install -m 0644 "$SRC_DIR/$LABEL.plist" "$PLIST_DST"
plutil -lint "$PLIST_DST"

echo "==> (Re)loading LaunchAgent"
UID0="$(id -u)"
launchctl bootout "gui/$UID0/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID0" "$PLIST_DST"

sleep 2
echo "==> Status:"
launchctl list | grep "$LABEL" || { echo "ERROR: agent not listed"; exit 1; }
echo "==> Listener:"
lsof -nP -iTCP:4319 -sTCP:LISTEN 2>/dev/null || { echo "ERROR: nothing listening on 4319"; exit 1; }
echo "==> Done. Clawket app should now connect via agent-habitat:4319."
