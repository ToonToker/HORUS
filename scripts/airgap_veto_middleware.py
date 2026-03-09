#!/usr/bin/env python3
"""HORUS air-gap outbound veto middleware.

Use by importing and calling install_airgap_veto() before any network clients are created.
It hard-fails process execution if outbound traffic is attempted to non-local routes.
"""

from __future__ import annotations

import builtins
import ipaddress
import socket
import sys
import urllib.parse
from typing import Iterable

_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}
_ORIGINAL_SOCKET = socket.socket.connect


def _is_private_or_loopback(host: str) -> bool:
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_loopback or addr.is_private
    except ValueError:
        return host.lower() in _ALLOWED_HOSTS


def _veto(message: str) -> None:
    print(f"[HORUS-VETO] {message}", file=sys.stderr)
    sys.exit(99)


def install_airgap_veto(allowed_proxy_hosts: Iterable[str] | None = None) -> None:
    proxy_set = set(_ALLOWED_HOSTS)
    if allowed_proxy_hosts:
        proxy_set.update(h.lower() for h in allowed_proxy_hosts)

    def guarded_connect(self: socket.socket, address):
        host = address[0] if isinstance(address, tuple) else str(address)
        normalized = host.lower().strip("[]")
        if normalized in proxy_set or _is_private_or_loopback(normalized):
            return _ORIGINAL_SOCKET(self, address)
        _veto(f"Blocked outbound connect to non-local host: {host}")

    socket.socket.connect = guarded_connect

    _original_open = builtins.__dict__.get("open")

    def guarded_open(file, *args, **kwargs):
        if isinstance(file, str):
            parsed = urllib.parse.urlparse(file)
            if parsed.scheme in {"http", "https"}:
                _veto(f"Blocked URL open attempt: {file}")
        return _original_open(file, *args, **kwargs)

    builtins.open = guarded_open


if __name__ == "__main__":
    install_airgap_veto()
    print("HORUS air-gap veto middleware installed")
