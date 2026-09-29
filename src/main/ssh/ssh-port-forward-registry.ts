import type { DetectedPort, PortForwardEntry, SavedPortForward } from '../../shared/ssh-types'
import type { SshConnection } from './ssh-connection'
import type { SshPortForwardManager } from './ssh-port-forward'
import { getSshTargetRegistryStore } from './ssh-target-registry'
import {
  publishLoopbackPort,
  publishedLoopbackEndpoint,
  unpublishLoopbackPort
} from '../ports/loopback-port-publisher'

type SshPortForwardRegistry = {
  manager: SshPortForwardManager
  getConnection: (targetId: string) => SshConnection | undefined
  listDetected: (targetId: string) => DetectedPort[]
}

let registry: SshPortForwardRegistry | null = null

export function setSshPortForwardRegistry(next: SshPortForwardRegistry | null): void {
  registry = next
}

export async function addRegisteredPortForward(args: {
  targetId: string
  localPort: number
  remoteHost: string
  remotePort: number
  label?: string
}): Promise<PortForwardEntry> {
  const { manager, connection } = requireForward(args.targetId)
  const entry = await manager.addForward(
    args.targetId,
    connection,
    args.localPort,
    args.remoteHost,
    args.remotePort,
    args.label
  )
  persist(args.targetId)
  return expose(entry)
}

export async function updateRegisteredPortForward(args: {
  id: string
  targetId: string
  localPort: number
  remoteHost: string
  remotePort: number
  label?: string
}): Promise<PortForwardEntry> {
  const { manager, connection } = requireForward(args.targetId)
  const previous = manager.listForwards(args.targetId).find((entry) => entry.id === args.id)
  const entry = await manager.updateForward(
    args.id,
    connection,
    args.localPort,
    args.remoteHost,
    args.remotePort,
    args.label
  )
  if (previous && previous.localPort !== entry.localPort) {
    unpublishLoopbackPort(previous.localPort)
  }
  persist(args.targetId)
  return expose(entry)
}

export async function removeRegisteredPortForward(id: string): Promise<PortForwardEntry | null> {
  const manager = registry?.manager
  if (!manager) {
    throw new Error('SSH port forwarding is not available on this Orca server')
  }
  const removed = await manager.removeForwardAndWait(id)
  if (!removed) {
    return null
  }
  unpublishLoopbackPort(removed.localPort)
  persist(removed.connectionId)
  return removed
}

export function listRegisteredPortForwards(targetId?: string): PortForwardEntry[] {
  const manager = registry?.manager
  if (!manager) {
    return []
  }
  return manager.listForwards(targetId).map(withPublishedEndpoint)
}

export function listRegisteredDetectedPorts(targetId: string): DetectedPort[] {
  return registry?.listDetected(targetId) ?? []
}

async function expose(entry: PortForwardEntry): Promise<PortForwardEntry> {
  await publishLoopbackPort(entry.localPort)
  return withPublishedEndpoint(entry)
}

function withPublishedEndpoint(entry: PortForwardEntry): PortForwardEntry {
  const published = publishedLoopbackEndpoint(entry.localPort)
  if (!published) {
    return entry
  }
  return { ...entry, publishedHost: published.host, publishedPort: published.port }
}

function persist(targetId: string): void {
  const manager = registry?.manager
  const store = getSshTargetRegistryStore()
  if (!manager || !store) {
    return
  }
  const saved: SavedPortForward[] = manager.listForwards(targetId).map((entry) => ({
    localPort: entry.localPort,
    remoteHost: entry.remoteHost,
    remotePort: entry.remotePort,
    label: entry.label
  }))
  store.updateTarget(targetId, { portForwards: saved.length > 0 ? saved : undefined })
}

function requireForward(targetId: string): {
  manager: SshPortForwardManager
  connection: SshConnection
} {
  if (!registry) {
    throw new Error('SSH port forwarding is not available on this Orca server')
  }
  const connection = registry.getConnection(targetId)
  if (!connection) {
    throw new Error(`SSH connection "${targetId}" not found`)
  }
  return { manager: registry.manager, connection }
}
