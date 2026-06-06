# Clawket bridge forwarder (agent-habitat → studio)

Makes the Clawket app's baked-in endpoint reach the bridge that actually runs on
the studio host.

## The problem this solves

```
Clawket app ──▶ agent-habitat.tail48d4cc.ts.net:4319   (Tailscale node: agent-habitat / 100.100.155.65)
                         │
                         ▼  (this forwarder)
              studio admins-mac-studio:4319             (Tailscale node: 100.89.167.39 — real bridge)
                         │
                         ▼
              Hermes API 127.0.0.1:8642                 (loopback-only on studio)
```

The Clawket mobile app is configured to connect to the **`agent-habitat`**
Tailscale node on port `4319`. But the `clawket bridge-cli` process runs on the
**studio** host, not inside the habitat VM — and it *must*, because it talks to
the Hermes API which is bound **loopback-only** on studio (`127.0.0.1:8642`), so
the bridge can only reach it from studio itself.

Result: nothing listened on `agent-habitat:4319`, every app connection was
refused, and the studio bridge logged `clients=0` indefinitely. Telegram was
unaffected (it flows through the Hermes gateway directly, not this bridge).

## The fix

A dependency-free (Python stdlib) transparent TCP forwarder runs on the
**agent-habitat VM**, listening on `0.0.0.0:4319` and forwarding to the studio
bridge at `100.89.167.39:4319`. It is transparent to the WebSocket upgrade and
bearer-token auth, so the app connects exactly as before — just to the right
place. Managed by a `launchd` LaunchAgent (`RunAtLoad` + `KeepAlive`).

## Install (run on the agent-habitat VM)

```sh
ssh admin@agent-habitat.local
cd /path/to/clawket/ops/clawket-forward
./install.sh
```

Or deploy from studio in one shot:

```sh
scp -r ops/clawket-forward admin@agent-habitat.local:~/clawket-forward
ssh admin@agent-habitat.local '~/clawket-forward/install.sh'
```

## Verify

From studio, connect through the app's exact URL and watch the bridge log flip
to `clients=1`:

```sh
tail -f /tmp/clawket-bridge.log    # on studio: look for clients=1
```

## Uninstall (on the agent-habitat VM)

```sh
launchctl bootout "gui/$(id -u)/com.binarybros.clawket-forward"
rm ~/Library/LaunchAgents/com.binarybros.clawket-forward.plist ~/clawket-bridge-forward.py
```

## Long-term alternative

Point the app's endpoint directly at `admins-mac-studio.tail48d4cc.ts.net:4319`
and drop this forwarder — but that requires an app rebuild, so the forwarder is
preferred unless a new build is already shipping.
