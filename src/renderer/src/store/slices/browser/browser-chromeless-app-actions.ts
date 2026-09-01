import { translate } from '@/i18n/i18n'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { folderWorkspaceKey } from '../../../../../shared/workspace-scope'
import {
  DEFAULT_CODE_SERVER_URL,
  DEFAULT_DEVIN_CLOUD_URL
} from '../../../../../shared/embedded-app-urls'
import type { AppState } from '../../types'
import type { BrowserSlice, BrowserSliceGet } from './browser-slice-contract'

// Chromeless embedded-app tabs (code-server, Devin Cloud): client-local
// webviews even on remote-owned worktrees — streamed remote pages would
// defeat the point, and the app's port must be reachable locally (port
// forward for remote hosts). Reuse is matched by URL origin so each app
// keeps one tab per worktree.
async function openChromelessAppTabInActiveWorkspace(
  get: BrowserSliceGet,
  input: { url: string; title: string }
): Promise<void> {
  const state = get() as AppState
  const worktreeId = state.activeWorktreeId
  if (!worktreeId) {
    return
  }
  const targetOrigin = new URL(input.url).origin
  const existing = (state.browserTabsByWorktree[worktreeId] ?? []).find((tab) => {
    if (tab.chromeless !== true) {
      return false
    }
    try {
      return new URL(tab.url).origin === targetOrigin
    } catch {
      return false
    }
  })
  if (existing) {
    const pageId = existing.activePageId ?? existing.pageIds?.[0]
    if (pageId) {
      state.focusBrowserTabInWorktree(worktreeId, pageId, { surfacePane: true })
      return
    }
  }
  const browserAvailability = getClientCreationActionPolicy(state, worktreeId)['managed-browser']
  if (browserAvailability.state !== 'enabled') {
    throw new Error(browserAvailability.reason)
  }
  const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(state, worktreeId)
  get().createBrowserTab(worktreeId, input.url, {
    title: input.title,
    activate: true,
    chromeless: true,
    ...(runtimeEnvironmentId ? { browserRuntimeEnvironmentId: null } : {})
  })
  get().recordFeatureInteraction('browser-tab-created')
}

export function createBrowserChromelessAppActions(
  get: BrowserSliceGet
): Pick<BrowserSlice, 'openCodeServerTabInActiveWorkspace' | 'openDevinCloudTabInActiveWorkspace'> {
  return {
    openCodeServerTabInActiveWorkspace: async () => {
      const state = get() as AppState
      const worktreePath =
        Object.values(state.worktreesByRepo ?? {})
          .flat()
          .find((worktree) => worktree.id === state.activeWorktreeId)?.path ??
        (state.folderWorkspaces ?? []).find(
          (workspace) => folderWorkspaceKey(workspace.id) === state.activeWorktreeId
        )?.folderPath
      if (state.activeWorktreeId && !worktreePath) {
        throw new Error('No worktree path is available for a code-server tab.')
      }
      const codeServerBaseUrl =
        (state.codeServerUrl ?? '').trim().replace(/\/+$/, '') || DEFAULT_CODE_SERVER_URL
      await openChromelessAppTabInActiveWorkspace(get, {
        url: `${codeServerBaseUrl}/?folder=${worktreePath}`,
        title: translate('auto.store.slices.browser.codeServerTabTitle', 'code-server')
      })
    },

    openDevinCloudTabInActiveWorkspace: async () => {
      const state = get() as AppState
      const devinCloudBaseUrl =
        (state.devinCloudUrl ?? '').trim().replace(/\/+$/, '') || DEFAULT_DEVIN_CLOUD_URL
      await openChromelessAppTabInActiveWorkspace(get, {
        url: devinCloudBaseUrl,
        title: translate('auto.store.slices.browser.devinCloudTabTitle', 'Devin')
      })
    }
  }
}
