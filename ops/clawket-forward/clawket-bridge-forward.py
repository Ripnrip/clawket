#!/usr/bin/env python3
"""Transparent TCP forwarder: agent-habitat:4319 -> studio clawket bridge:4319.
Lets the Clawket app's baked-in endpoint reach the bridge that actually runs on
studio (Hermes API is loopback-only there, so the bridge must live on studio).
Stdlib only. Reversible: unload the LaunchAgent and delete this file."""
import socket
import threading

LISTEN = ("0.0.0.0", 4319)
TARGET = ("100.89.167.39", 4319)  # studio Tailscale IP (stable per-node)


def pipe(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for s in (src, dst):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(client):
    try:
        upstream = socket.create_connection(TARGET, 10)
    except OSError:
        client.close()
        return
    threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
    threading.Thread(target=pipe, args=(upstream, client), daemon=True).start()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(LISTEN)
    srv.listen(128)
    print(f"forwarding {LISTEN} -> {TARGET}", flush=True)
    while True:
        client, _ = srv.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()


if __name__ == "__main__":
    main()
