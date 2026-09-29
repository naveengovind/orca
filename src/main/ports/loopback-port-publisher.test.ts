import { createConnection, createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  publishLoopbackPort,
  resetLoopbackPortPublisherForTests,
  unpublishLoopbackPort
} from './loopback-port-publisher'
import { setServeAdvertisedHost } from '../startup/serve-advertised-host'

afterEach(() => {
  resetLoopbackPortPublisherForTests()
  setServeAdvertisedHost(null)
})

describe('publishLoopbackPort', () => {
  it('does nothing when orca serve is not advertising a reachable address', async () => {
    await expect(publishLoopbackPort(3999)).resolves.toBeNull()
  })

  it('bridges the advertised address to the loopback port', async () => {
    const backend = createServer((socket) => {
      socket.on('data', (chunk) => socket.write(chunk))
    })
    const localPort = await new Promise<number>((resolve) => {
      backend.listen(0, '127.0.0.1', () => {
        const address = backend.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    })
    setServeAdvertisedHost('127.0.0.2')

    try {
      const published = await publishLoopbackPort(localPort)
      expect(published?.host).toBe('127.0.0.2')
      expect(published?.port).toBe(localPort)

      const echoed = await new Promise<string>((resolve, reject) => {
        const socket = createConnection({ host: '127.0.0.2', port: localPort }, () => {
          socket.write('ping')
        })
        socket.once('data', (chunk) => {
          socket.end()
          resolve(chunk.toString())
        })
        socket.once('error', reject)
      })
      expect(echoed).toBe('ping')

      const again = await publishLoopbackPort(localPort)
      expect(again).toEqual(published)
    } finally {
      unpublishLoopbackPort(localPort)
      await new Promise<void>((resolve) => backend.close(() => resolve()))
    }
  })
})
