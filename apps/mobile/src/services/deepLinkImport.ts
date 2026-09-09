import * as Clipboard from 'expo-clipboard';
import { parseQRPayload } from '../screens/ConfigScreen/qrPayload';
import { parseDeepLink } from './deepLinks';
import type { GatewayScanPayload } from '../hooks/gatewayScanFlow';

/**
 * Import a gateway pairing invite that arrives outside the QR scanner:
 *
 *  - a `clawket://connect?url=...&token=...` deep link (Messages / AirDrop),
 *  - or any of the QR payload formats the scanner accepts (JSON / openclaw://).
 *
 * Both are reduced to the same `GatewayScanPayload` the scan flow produces, so
 * the onboarding navigator can hand the result straight to the shared connect
 * handler.
 */

/** Parse a single piece of invite text into a gateway scan payload. */
export function parseImportText(text: string): GatewayScanPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try the clawket:// deep-link scheme first (connect + other routes).
  if (trimmed.startsWith('clawket://')) {
    const action = parseDeepLink(trimmed);
    if (action?.type === 'connect') {
      return {
        url: action.url,
        token: action.token,
        password: action.password,
      };
    }
    return null;
  }

  return parseQRPayload(trimmed) as GatewayScanPayload | null;
}

/** Read and parse a pairing invite from the clipboard. */
export async function readClipboardImport(): Promise<GatewayScanPayload | null> {
  try {
    const text = await Clipboard.getStringAsync();
    if (!text) return null;
    return parseImportText(text);
  } catch {
    return null;
  }
}

/** True when the given clickable URL is a `clawket://` invite we can connect to. */
export function isConnectInviteUrl(url: string): boolean {
  const action = parseDeepLink(url);
  return action?.type === 'connect';
}