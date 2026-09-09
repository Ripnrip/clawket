import { resolveNearbyOutcome } from './nearbyDiscovery';

describe('resolveNearbyOutcome', () => {
  const baseGateway = {
    id: 'gw-1',
    name: 'Hermes on Mac Studio',
    host: '192.168.1.20',
    port: 4319,
    attributes: {},
  };

  describe('usable advertisements', () => {
    it('builds a ready payload when TXT carries a token', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        attributes: {
          token: 'tok-abc',
          path: 'v1/hermes/ws',
          label: 'Studio',
        },
      });
      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(outcome.payload).toMatchObject({
          url: 'http://192.168.1.20:4319/v1/hermes/ws',
          token: 'tok-abc',
          backendKind: 'hermes',
          transportKind: 'local',
          mode: 'hermes',
          hermes: {
            bridgeUrl: 'http://192.168.1.20:4319/v1/hermes/ws',
            displayName: 'Studio',
          },
        });
      }
    });

    it('honors an explicit url TXT attribute over synthesized ones', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        attributes: {
          token: 'tok-abc',
          url: 'ws://gateway.internal/v1/hermes/ws',
        },
      });
      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(outcome.payload.url).toBe('ws://gateway.internal/v1/hermes/ws');
      }
    });

    it('uses the advertised scheme and normalizes path slashes', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        attributes: {
          token: 'tok-abc',
          scheme: 'ws',
          path: '//v1/hermes/ws/',
        },
      });
      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(outcome.payload.url).toBe('ws://192.168.1.20:4319/v1/hermes/ws');
      }
    });

    it('brackets IPv6 hosts in the synthesized URL', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        host: 'fe80::1',
        attributes: { token: 'tok-abc' },
      });
      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(outcome.payload.url).toBe('http://[fe80::1]:4319');
      }
    });

    it('falls back to the service name for display name when no label', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        attributes: { token: 'tok-abc' },
      });
      expect(outcome.kind).toBe('ready');
      if (outcome.kind === 'ready') {
        expect(outcome.payload.hermes.displayName).toBe('Hermes on Mac Studio');
      }
    });
  });

  describe('missing credentials', () => {
    it('returns needsCredentials when the endpoint is usable but no token', () => {
      const outcome = resolveNearbyOutcome(baseGateway);
      expect(outcome.kind).toBe('needsCredentials');
      if (outcome.kind === 'needsCredentials') {
        expect(outcome.url).toBe('http://192.168.1.20:4319');
        expect(outcome.name).toBe('Hermes on Mac Studio');
      }
    });

    it('still returns needsCredentials when a claim is advertised', () => {
      const outcome = resolveNearbyOutcome({
        ...baseGateway,
        attributes: { claim: 'claim-xyz' },
      });
      expect(outcome.kind).toBe('needsCredentials');
    });
  });

  describe('unusable advertisements', () => {
    it('rejects missing hosts', () => {
      const outcome = resolveNearbyOutcome({ ...baseGateway, host: '' });
      expect(outcome.kind).toBe('unusable');
    });

    it('rejects out-of-range ports', () => {
      expect(resolveNearbyOutcome({ ...baseGateway, port: 0 }).kind).toBe('unusable');
      expect(resolveNearbyOutcome({ ...baseGateway, port: 65536 }).kind).toBe('unusable');
    });
  });
});