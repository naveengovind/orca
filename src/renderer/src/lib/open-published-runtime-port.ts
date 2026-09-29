import { callRuntimeRpc, type RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { useAppStore } from '@/store'
import type { WorkspacePort } from '../../../shared/workspace-ports'
import { isPairedWebClientWindow } from './desktop-window-chrome'

type BrowserTabCreator = ReturnType<typeof useAppStore.getState>['createBrowserTab']

const PUBLISH_UNAVAILABLE = 'Workspace ports are unavailable for this execution host.'

/** Open a remote orca serve port through the address paired clients already dial. */
export async function openPublishedRuntimePort(
  args: {
    port: WorkspacePort
    runtimeTarget: RuntimeClientTarget
    createBrowserTab: BrowserTabCreator
    openInOrcaBrowser?: boolean
  },
  worktreeId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (args.runtimeTarget.kind !== 'environment') {
    return { ok: false, reason: PUBLISH_UNAVAILABLE }
  }
  try {
    const published = await callRuntimeRpc<{ url: string }>(
      args.runtimeTarget,
      'workspacePorts.publish',
      { port: args.port.port },
      { timeoutMs: 15_000 }
    )
    // Why: the paired web client has no local TCP stack. A system browser tab
    // on the address orca serve republished is the forward.
    if (args.openInOrcaBrowser === false || isPairedWebClientWindow()) {
      await window.api.shell.openUrl(published.url)
      return { ok: true }
    }
    args.createBrowserTab(worktreeId, published.url, { activate: true })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: message || 'Failed to publish port.' }
  }
}
