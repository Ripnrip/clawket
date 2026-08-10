# Pairing Lottie asset pack

Tracked as Multica **HAB-240** (assets) under project *Hermes Pairing Transports Onboarding*.
Linear project: https://linear.app/binary-bros/project/hermes-pairing-transports-onboarding-0aee73d402ae
(Linear issue create blocked by free-tier activeIssueCount — Multica is source of truth for tickets.)

## Mapping

| Transport | File | Notes |
| --- | --- | --- |
| Tailscale | `tailscale-connectivity.json` | From user Downloads/connectivity.json |
| Bonjour / Multipeer / nearby | `nearby-pulse.json` | Placeholder until dedicated Bluetooth Lottie is dropped in |
| Link / AirDrop handoff | `link-vector.json` | Generic link animation |

## Intended replacements

- Multipeer: https://lottiefiles.com/free-animation/bluetooth-wRABULKk8M
- Nearby/Bonjour: https://app.lottiefiles.com/animation/9865842e-5002-431a-a0e7-19bc5a7f155b

Drop the JSON files into this folder (and mirror into Clawket mobile / Habitat Chat / HermesFeature Resources) with the same filenames, then rebuild.

## Consumers

- Clawket mobile: `apps/mobile/assets/lottie/` + `QuickConnectGuideCard` / `QuickConnectionPanel` (HAB-241)
- Agent Habitat Chat: `assets/lottie/` (HAB-242)
- Hermes App: `HermesPackage/.../Resources/Lottie/` (HAB-243)

## License

Only use LottieFiles free animations under their free license, or assets you own. Keep attribution if required by the source.
