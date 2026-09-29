import { defineMethod } from '../core'
import {
  WorkspacePortKillParams,
  WorkspacePortPublishParams,
  WorkspacePortScanParams
} from '../../../../shared/rpc-contract/workspace-ports-params'
import { publishLoopbackPort } from '../../../ports/loopback-port-publisher'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'])

export const WORKSPACE_PORT_METHODS = [
  defineMethod({
    name: 'workspacePorts.scan',
    params: WorkspacePortScanParams,
    handler: async (params, { runtime }) => runtime.scanWorkspacePorts(params.repoId)
  }),
  defineMethod({
    name: 'workspacePorts.kill',
    params: WorkspacePortKillParams,
    handler: async (params, { runtime }) =>
      runtime.killWorkspacePort({
        repoId: params.repoId,
        pid: params.pid,
        port: params.port
      })
  }),
  defineMethod({
    name: 'workspacePorts.publish',
    params: WorkspacePortPublishParams,
    handler: async (params) => {
      const host = params.host?.trim() || '127.0.0.1'
      if (!LOOPBACK_HOSTS.has(host)) {
        throw new Error('Only loopback ports on this Orca server can be published')
      }
      const published = await publishLoopbackPort(params.port)
      if (!published) {
        return {
          host: '127.0.0.1',
          port: params.port,
          url: `http://127.0.0.1:${params.port}/`
        }
      }
      const printableHost = published.host.includes(':') ? `[${published.host}]` : published.host
      return {
        host: published.host,
        port: published.port,
        url: `http://${printableHost}:${published.port}/`
      }
    }
  })
]
