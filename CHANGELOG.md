# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed
- **Clawket bridge connectivity** — the mobile app could not connect to the
  bridge (`clients=0` for days) due to a host mismatch: the app's baked-in
  endpoint `agent-habitat.tail48d4cc.ts.net:4319` pointed at the habitat VM,
  but the `bridge-cli` process runs on the studio host (it must, because the
  Hermes API is loopback-only on studio). Telegram was unaffected.

### Added
- **`ops/clawket-forward/`** — reproducible deployment of a Python-stdlib TCP
  forwarder that runs on the agent-habitat VM and forwards `:4319` to the studio
  bridge (`100.89.167.39:4319`), so the app's existing endpoint reaches the real
  bridge with no app rebuild. Managed by a `launchd` LaunchAgent
  (`com.binarybros.clawket-forward`, `RunAtLoad` + `KeepAlive`). Includes
  `install.sh` and a README documenting the topology.
