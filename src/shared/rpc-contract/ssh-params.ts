import { z } from 'zod'

const TcpPort = z.number().int().min(1).max(65535)

export const SshTarget = z.object({
  targetId: z.string().min(1)
})

export const SshPortForwardCreate = z.object({
  targetId: z.string().min(1),
  localPort: TcpPort,
  remoteHost: z.string().min(1),
  remotePort: TcpPort,
  label: z.string().optional()
})

export const SshPortForwardUpdate = z.object({
  id: z.string().min(1),
  targetId: z.string().min(1),
  localPort: TcpPort,
  remoteHost: z.string().min(1),
  remotePort: TcpPort,
  label: z.string().optional()
})

export const SshPortForwardRemove = z.object({
  id: z.string().min(1)
})
