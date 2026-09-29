const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

let advertisedHost: string | null = null

/** Reachable address `orca serve` told clients to dial. Loopback is not advertised. */
export function setServeAdvertisedHost(host: string | null | undefined): void {
  const value = host?.trim() ?? ''
  advertisedHost = value && !LOOPBACK_HOSTS.has(value) ? value : null
}

export function getServeAdvertisedHost(): string | null {
  return advertisedHost
}
