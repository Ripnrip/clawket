import { type EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/**
 * mDNS/Bonjour discovery for Hermes gateways.
 *
 * The native side browses `_hermes._tcp` and emits each resolved, connectable
 * gateway as an {@link DiscoveredNearbyGateway}. The pure
 * {@link resolveNearbyOutcome} mapping decides what to do with it, mirroring
 * the macOS app's `NearbyDiscoveryLogic.outcome()`.
 */

/** mDNS service type a Hermes host advertises during pairing. */
export const NEARBY_SERVICE_TYPE = '_hermes._tcp';

/** A gateway resolved from a Bonjour advertisement. */
export type DiscoveredNearbyGateway = {
  /** Stable id for the advertisement (used for dedup). */
  id: string;
  /** Human readable service name the host registered. */
  name: string;
  /** Resolved IP address (IPv4 or IPv6 literal). */
  host: string;
  /** Resolved service port. */
  port: number;
  /** TXT record the host advertised (scheme, path, token, label, claim). */
  attributes: Record<string, string>;
};

/**
 * What to do with a discovered gateway.
 * Mirrors `NearbyDiscoveryLogic.Outcome` — a pure decision with no side
 * effects, so it can be unit tested without a live network.
 */
export type NearbyOutcome =
  /** TXT carried a token — auto-connect with zero user input. */
  | { kind: 'ready'; payload: NearbyReadyPayload }
  /** Host/port known but no credential advertised — prefill manual entry. */
  | { kind: 'needsCredentials'; url: string; name: string }
  /** The advertisement cannot be turned into a connection. */
  | { kind: 'unusable'; message: string };

/** A connectable Hermes gateway scan payload (matches QR-scan resolution). */
export type NearbyReadyPayload = {
  url: string;
  token?: string;
  backendKind: 'hermes';
  transportKind: 'local';
  mode: 'hermes';
  hermes: {
    bridgeUrl: string;
    displayName?: string;
  };
};

/**
 * Pure decision logic for a resolved gateway advertisement.
 *
 * Produces the same kind of payload the QR-scan flow resolves to, so the
 * nearby flow can hand the result straight to the shared connect handler.
 */
export function resolveNearbyOutcome(gateway: DiscoveredNearbyGateway): NearbyOutcome {
  const { host, port, attributes } = gateway;
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return { kind: 'unusable', message: 'The service did not expose a reachable endpoint.' };
  }

  const scheme = (attributes.scheme ?? 'http').trim().toLowerCase();
  const trimmedPath = (attributes.path ?? '').trim().replace(/^\/+|\/+$/g, '');
  const pathPrefix = trimmedPath ? `/${trimmedPath}` : '';
  const hostPart = host.includes(':') ? `[${host}]` : host;

  // Explicit `url` TXT attribute wins; otherwise synthesize a URL from the
  // scheme + host + port the host advertised.
  const explicitUrl = attributes.url?.trim();
  const url = explicitUrl || `${scheme}://${hostPart}:${port}${pathPrefix}`;

  const name = attributes.label?.trim() || gateway.name;
  const token = attributes.token?.trim();

  if (token) {
    return {
      kind: 'ready',
      payload: {
        url,
        token,
        backendKind: 'hermes',
        transportKind: 'local',
        mode: 'hermes',
        hermes: {
          bridgeUrl: url,
          displayName: name,
        },
      },
    };
  }

  return { kind: 'needsCredentials', url, name };
}

// ─── Native module wrapper ───

type NativeNearbyDiscoveryModule = {
  startAsync(serviceType: string): Promise<void>;
  stopAsync(): Promise<void>;
  addListener(
    eventName: 'onGatewayFound',
    listener: (event: DiscoveredNearbyGateway) => void
  ): EventSubscription;
  addListener(
    eventName: 'onDiscoveryError',
    listener: (event: { code: string; message: string }) => void
  ): EventSubscription;
};

const nativeModule = requireOptionalNativeModule<NativeNearbyDiscoveryModule>(
  'ClawketNearbyDiscovery'
);

export function isNearbyDiscoverySupported(): boolean {
  return Platform.OS === 'ios' && !!nativeModule;
}

export async function startNearbyDiscovery(
  serviceType: string = NEARBY_SERVICE_TYPE
): Promise<void> {
  if (!nativeModule) {
    return;
  }
  await nativeModule.startAsync(serviceType);
}

export async function stopNearbyDiscovery(): Promise<void> {
  if (!nativeModule) {
    return;
  }
  await nativeModule.stopAsync();
}

export function addNearbyGatewayListener(
  listener: (event: DiscoveredNearbyGateway) => void
): EventSubscription | null {
  if (!nativeModule) {
    return null;
  }
  return nativeModule.addListener('onGatewayFound', listener);
}

export function addNearbyErrorListener(
  listener: (event: { code: string; message: string }) => void
): EventSubscription | null {
  if (!nativeModule) {
    return null;
  }
  return nativeModule.addListener('onDiscoveryError', listener);
}