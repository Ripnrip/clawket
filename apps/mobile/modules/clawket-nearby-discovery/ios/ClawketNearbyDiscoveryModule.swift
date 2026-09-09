import ExpoModulesCore
import Network

/// iOS mDNS/Bonjour discovery for Hermes gateways.
///
/// Browsers the `_hermes._tcp` service type a Hermes host advertises during
/// pairing (`hermes pair local --transport bonjour`) and emits each resolved,
/// connectable gateway as an `onGatewayFound` event carrying host, port and the
/// host's TXT record (scheme, path, token, label, claim).
///
/// Mirrors the macOS app's `NearbyDiscoveryModel`; only the delivery
/// mechanism changes (Expo events instead of a Swift callback).
public final class ClawketNearbyDiscoveryModule: Module {
  private let foundEvent = "onGatewayFound"
  private let errorEvent = "onDiscoveryError"

  /// TXT keys a Hermes host may advertise.
  private enum TXTKey {
    static let claim = "claim"
    static let token = "token"
    static let path = "path"
    static let scheme = "scheme"
    static let label = "label"
    static let url = "url"
  }

  private final class Storage: @unchecked Sendable {
    var browser: NWBrowser?
    var resolver: NWConnection?
    var resolutionTask: Task<Void, Never>?

    func cancelAll() {
      browser?.cancel()
      resolver?.cancel()
      resolutionTask?.cancel()
    }
  }

  private let storage = Storage()
  private var discoveredIds: Set<String> = []

  public func definition() -> ModuleDefinition {
    Name("ClawketNearbyDiscovery")

    Events(foundEvent, errorEvent)

    AsyncFunction("startAsync") { (serviceType: String?, promise: Promise) in
      self.startBrowsing(serviceType: serviceType ?? "_hermes._tcp")
      promise.resolve(nil)
    }.runOnQueue(.main)

    AsyncFunction("stopAsync") { (promise: Promise) in
      self.stopBrowsing()
      promise.resolve(nil)
    }.runOnQueue(.main)

    OnDestroy {
      self.stopBrowsing()
    }
  }

  // MARK: Lifecycle

  private func startBrowsing(serviceType: String) {
    guard storage.browser == nil else {
      return
    }
    discoveredIds = []

    let parameters = NWParameters()
    parameters.includePeerToPeer = true
    let browser = NWBrowser(
      for: .bonjour(type: serviceType, domain: nil),
      using: parameters
    )
    storage.browser = browser

    browser.browseResultsChangedHandler = { [weak self] results, _ in
      let endpoints = results.map(\.endpoint)
      Task { @MainActor [weak self] in
        self?.browseResultsChanged(endpoints)
      }
    }
    browser.stateUpdateHandler = { [weak self] state in
      Task { @MainActor [weak self] in
        guard let self else { return }
        switch state {
        case .failed(let error):
          self.sendEvent(self.errorEvent, [
            "code": "ERR_DISCOVERY_FAILED",
            "message": error.localizedDescription,
          ])
          self.stopBrowsing()
        default:
          break
        }
      }
    }
    browser.start(queue: .main)
  }

  func stopBrowsing() {
    storage.cancelAll()
    storage.browser = nil
    storage.resolver = nil
    storage.resolutionTask = nil
    discoveredIds = []
  }

  // MARK: Browsing

  private func browseResultsChanged(_ endpoints: [NWEndpoint]) {
    for endpoint in endpoints {
      let id = String(describing: endpoint)
      if discoveredIds.contains(id) {
        continue
      }
      discoveredIds.insert(id)
      resolve(endpoint)
    }
  }

  /// Resolves a service endpoint into a concrete host/port + TXT record by
  /// opening a throwaway connection and reading the resolved endpoint.
  private func resolve(_ endpoint: NWEndpoint) {
    storage.resolutionTask?.cancel()

    let connection = NWConnection(to: endpoint, using: .tcp)
    storage.resolver = connection

    storage.resolutionTask = Task { [weak self] in
      let resolved: (NWEndpoint?, [String: String]) = await withCheckedContinuation { continuation in
        connection.stateUpdateHandler = { state in
          switch state {
          case .ready:
            connection.stateUpdateHandler = nil
            let remote = connection.currentPath?.remoteEndpoint ?? connection.endpoint
            let txt = Self.txtDictionary(from: connection.endpoint)
            continuation.resume(returning: (remote, txt))
          case .failed, .cancelled:
            connection.stateUpdateHandler = nil
            continuation.resume(returning: (nil, [:]))
          default:
            break
          }
        }
        connection.start(queue: .main)
      }
      connection.cancel()

      guard let self else { return }
      self.storage.resolver = nil
      self.storage.resolutionTask = nil

      guard !Task.isCancelled else { return }
      guard let remote = resolved.0 else {
        return
      }
      guard let hostPort = Self.hostPort(of: remote) else {
        return
      }

      let name: String
      if case let .service(serviceName, _, _, _) = endpoint {
        name = serviceName
      } else {
        name = "Hermes Gateway"
      }

      self.sendEvent(self.foundEvent, [
        "id": String(describing: endpoint),
        "name": name,
        "host": hostPort.host,
        "port": hostPort.port,
        "attributes": resolved.1,
      ])
    }
  }

  // MARK: Endpoint helpers

  /// Extracts a host string and port from a resolved endpoint.
  nonisolated static func hostPort(of endpoint: NWEndpoint) -> (host: String, port: Int)? {
    switch endpoint {
    case let .hostPort(host, port):
      return (hostDescription(host), Int(port.rawValue))
    case let .service(_, _, _, interface):
      _ = interface
      return nil
    default:
      return nil
    }
  }

  nonisolated static func hostDescription(_ host: NWEndpoint.Host) -> String {
    switch host {
    case let .ipv4(address):
      return "\(address)"
    case let .ipv6(address):
      return "\(address)"
    case let .name(name, _):
      return name
    @unknown default:
      return "\(host)"
    }
  }

  /// Reads the TXT keys the Hermes host is known to advertise. `NWTXTRecord`
  /// offers key lookup but not enumeration, so probe the known set.
  nonisolated static func txtDictionary(from endpoint: NWEndpoint) -> [String: String] {
    guard let txt = endpoint.txtRecord else { return [:] }
    var result: [String: String] = [:]
    for key in [TXTKey.claim, TXTKey.token, TXTKey.path, TXTKey.scheme, TXTKey.label, TXTKey.url] {
      if let value = txt[key], !value.isEmpty {
        result[key] = value
      }
    }
    return result
  }
}