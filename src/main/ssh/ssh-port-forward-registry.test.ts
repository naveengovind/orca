import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PortForwardEntry } from '../../shared/ssh-types'
import {
  addRegisteredPortForward,
  listRegisteredDetectedPorts,
  listRegisteredPortForwards,
  setSshPortForwardRegistry
} from './ssh-port-forward-registry'
import { resetLoopbackPortPublisherForTests } from '../ports/loopback-port-publisher'
import { setServeAdvertisedHost } from '../startup/serve-advertised-host'

const entry: PortForwardEntry = {
  id: 'pf-1',
  connectionId: 'ssh-1',
  localPort: 41731,
  remoteHost: '127.0.0.1',
  remotePort: 3000
}

afterEach(() => {
  setSshPortForwardRegistry(null)
  resetLoopbackPortPublisherForTests()
  setServeAdvertisedHost(null)
})

describe('registered SSH port forwards', () => {
  it('adds a forward and republishes it on the orca serve address', async () => {
    setServeAdvertisedHost('127.0.0.2')
    const addForward = vi.fn(async () => entry)
    setSshPortForwardRegistry({
      manager: {
        addForward,
        listForwards: () => [entry]
      } as never,
      getConnection: () => ({}) as never,
      listDetected: () => [{ port: 3000, host: '127.0.0.1' }]
    })

    const created = await addRegisteredPortForward({
      targetId: 'ssh-1',
      localPort: 41731,
      remoteHost: '127.0.0.1',
      remotePort: 3000
    })

    expect(addForward).toHaveBeenCalledWith('ssh-1', {}, 41731, '127.0.0.1', 3000, undefined)
    expect(created.publishedHost).toBe('127.0.0.2')
    expect(created.publishedPort).toBe(41731)
    expect(listRegisteredPortForwards('ssh-1')[0]?.publishedHost).toBe('127.0.0.2')
    expect(listRegisteredDetectedPorts('ssh-1')).toEqual([{ port: 3000, host: '127.0.0.1' }])
  })

  it('refuses to forward when this process has no SSH session', async () => {
    await expect(
      addRegisteredPortForward({
        targetId: 'ssh-1',
        localPort: 1,
        remoteHost: '127.0.0.1',
        remotePort: 2
      })
    ).rejects.toThrow('SSH port forwarding is not available on this Orca server')
  })
})
