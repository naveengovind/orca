import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import {
  createBrowserMockApi,
  createTestStore,
  runtimeStatuses
} from './browser-slice-test-harness'

const createWebRuntimeSessionBrowserTabMock = vi.hoisted(() => vi.fn())
const runtimeEnvironmentTransportCall = vi.fn()

vi.mock('@/runtime/web-runtime-session', () => ({
  createWebRuntimeSessionBrowserTab: createWebRuntimeSessionBrowserTabMock
}))

const mockApi = createBrowserMockApi(runtimeEnvironmentTransportCall)

// @ts-expect-error test window mock
globalThis.window = { api: mockApi }

function seedActiveWorktreePath(store: ReturnType<typeof createTestStore>): void {
  store.setState({
    worktreesByRepo: {
      'repo-1': [
        {
          id: 'wt-1',
          repoId: 'repo-1',
          path: '/repo/wt-1',
          head: 'abc123',
          branch: 'feature',
          isBare: false,
          isMainWorktree: false,
          displayName: 'Workspace',
          comment: '',
          linkedIssue: null,
          linkedPR: null,
          linkedLinearIssue: null,
          isArchived: false,
          isUnread: false,
          isPinned: false,
          sortOrder: 0,
          lastActivityAt: 1
        }
      ]
    }
  })
}

describe('openCodeServerTabInActiveWorkspace', () => {
  it('creates a chromeless tab pointed at code-server for the worktree path', async () => {
    const store = createTestStore()
    seedActiveWorktreePath(store)

    await store.getState().openCodeServerTabInActiveWorkspace()

    expect(store.getState().browserTabsByWorktree['wt-1']?.[0]).toMatchObject({
      url: 'http://127.0.0.1:13337/?folder=/repo/wt-1',
      chromeless: true
    })
    expect(store.getState().recordFeatureInteraction).toHaveBeenCalledWith('browser-tab-created')
  })

  it('focuses the existing chromeless tab instead of creating a second one', async () => {
    const store = createTestStore()
    seedActiveWorktreePath(store)

    await store.getState().openCodeServerTabInActiveWorkspace()
    await store.getState().openCodeServerTabInActiveWorkspace()

    expect(store.getState().browserTabsByWorktree['wt-1']).toHaveLength(1)
  })

  it('does not mark ordinary browser tabs chromeless', () => {
    const store = createTestStore()

    store.getState().createBrowserTab('wt-1', 'https://example.com')

    expect(store.getState().browserTabsByWorktree['wt-1']?.[0]?.chromeless).toBeUndefined()
  })

  it('creates a client-local chromeless tab for a paired-runtime worktree', async () => {
    const store = createTestStore()
    store.setState({
      activeWorktreeId: 'wt-remote',
      settings: { activeRuntimeEnvironmentId: null } as AppState['settings'],
      runtimeStatusByEnvironmentId: runtimeStatuses(['browser.headless.v1']),
      repos: [
        {
          id: 'repo-1',
          path: '/repo',
          displayName: 'Repo',
          badgeColor: '#000000',
          addedAt: 1,
          connectionId: null,
          executionHostId: 'runtime:env-1'
        }
      ],
      worktreesByRepo: {
        'repo-1': [
          {
            id: 'wt-remote',
            repoId: 'repo-1',
            path: '/repo/wt-remote',
            head: 'abc123',
            branch: 'feature',
            isBare: false,
            isMainWorktree: false,
            displayName: 'Remote',
            comment: '',
            linkedIssue: null,
            linkedPR: null,
            linkedLinearIssue: null,
            isArchived: false,
            isUnread: false,
            isPinned: false,
            sortOrder: 0,
            lastActivityAt: 1
          }
        ]
      }
    })

    await store.getState().openCodeServerTabInActiveWorkspace()

    expect(createWebRuntimeSessionBrowserTabMock).not.toHaveBeenCalled()
    expect(store.getState().browserTabsByWorktree['wt-remote']?.[0]).toMatchObject({
      url: 'http://127.0.0.1:13337/?folder=/repo/wt-remote',
      chromeless: true
    })
    const workspaceId = store.getState().browserTabsByWorktree['wt-remote']?.[0]?.id ?? ''
    expect(
      store.getState().browserPagesByWorkspace[workspaceId]?.[0]?.browserRuntimeEnvironmentId
    ).toBeNull()
  })

  it('honors the configured code-server URL setting', async () => {
    const store = createTestStore()
    seedActiveWorktreePath(store)
    store.setState({ codeServerUrl: 'https://dev-box.tailnet.ts.net:13337/' })

    await store.getState().openCodeServerTabInActiveWorkspace()

    expect(store.getState().browserTabsByWorktree['wt-1']?.[0]?.url).toBe(
      'https://dev-box.tailnet.ts.net:13337/?folder=/repo/wt-1'
    )
  })

  it('opens Devin Cloud as a chromeless tab and keeps it separate from code-server', async () => {
    const store = createTestStore()
    seedActiveWorktreePath(store)

    await store.getState().openDevinCloudTabInActiveWorkspace()
    await store.getState().openCodeServerTabInActiveWorkspace()

    const tabs = store.getState().browserTabsByWorktree['wt-1'] ?? []
    expect(tabs).toHaveLength(2)
    expect(tabs.map((tab) => tab.url).sort()).toEqual([
      'http://127.0.0.1:13337/?folder=/repo/wt-1',
      'https://app.devin.ai'
    ])
    expect(tabs.every((tab) => tab.chromeless === true)).toBe(true)

    // Reuse matches by origin: reopening Devin focuses, not duplicates.
    await store.getState().openDevinCloudTabInActiveWorkspace()
    expect(store.getState().browserTabsByWorktree['wt-1']).toHaveLength(2)
  })

  it('honors the configured Devin Cloud URL setting', async () => {
    const store = createTestStore()
    seedActiveWorktreePath(store)
    store.setState({ devinCloudUrl: 'https://devin.mycorp.dev/' })

    await store.getState().openDevinCloudTabInActiveWorkspace()

    expect(store.getState().browserTabsByWorktree['wt-1']?.[0]?.url).toBe(
      'https://devin.mycorp.dev'
    )
  })

  it('rejects when no worktree path is known for the active worktree', async () => {
    const store = createTestStore()

    await expect(store.getState().openCodeServerTabInActiveWorkspace()).rejects.toThrow(
      'No worktree path is available'
    )
  })
})
