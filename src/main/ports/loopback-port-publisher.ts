import { createConnection, createServer, type Server, type Socket } from 'node:net'
import { getServeAdvertisedHost } from '../startup/serve-advertised-host'

type PublishedLoopback = {
  host: string
  port: number
  server: Server
}

const published = new Map<number, PublishedLoopback>()

export type PublishedLoopbackEndpoint = {
  host: string
  port: number
}

/**
 * Republish a loopback listener on the address paired clients already use to
 * reach `orca serve`, so a browser on another machine can open it.
 * No-op when serve is not advertising a non-loopback address.
 */
export async function publishLoopbackPort(
  localPort: number
): Promise<PublishedLoopbackEndpoint | null> {
  const host = getServeAdvertisedHost()
  if (!host) {
    return null
  }
  const existing = published.get(localPort)
  if (existing) {
    return { host: existing.host, port: existing.port }
  }

  const server = createServer((socket) => bridgeToLoopback(socket, localPort))
  try {
    const port = await listen(server, host, localPort)
    published.set(localPort, { host, port, server })
    return { host, port }
  } catch (error) {
    const inUse = isAddrInUse(error)
    server.close()
    if (!inUse) {
      throw error
    }
    const fallback = createServer((socket) => bridgeToLoopback(socket, localPort))
    const port = await listen(fallback, host, 0)
    published.set(localPort, { host, port, server: fallback })
    return { host, port }
  }
}

export function publishedLoopbackEndpoint(localPort: number): PublishedLoopbackEndpoint | null {
  const existing = published.get(localPort)
  return existing ? { host: existing.host, port: existing.port } : null
}

export function unpublishLoopbackPort(localPort: number): void {
  const existing = published.get(localPort)
  if (!existing) {
    return
  }
  published.delete(localPort)
  existing.server.close()
}

export function resetLoopbackPortPublisherForTests(): void {
  for (const existing of published.values()) {
    existing.server.close()
  }
  published.clear()
}

function bridgeToLoopback(socket: Socket, localPort: number): void {
  const upstream = createConnection({ host: '127.0.0.1', port: localPort })
  const closeBoth = (): void => {
    socket.destroy()
    upstream.destroy()
  }
  socket.on('error', closeBoth)
  upstream.on('error', closeBoth)
  socket.on('close', () => upstream.destroy())
  upstream.on('close', () => socket.destroy())
  socket.pipe(upstream)
  upstream.pipe(socket)
}

function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = (): void => {
      server.removeListener('error', onError)
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error(`Failed to publish 127.0.0.1 on ${host}`))
        return
      }
      resolve(address.port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  )
}
