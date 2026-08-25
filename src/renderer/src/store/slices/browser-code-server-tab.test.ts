import { describe, expect, it, vi } from 'vitest'
import { createBrowserMockApi, createTestStore } from './browser-slice-test-harness'

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

  it('rejects when no worktree path is known for the active worktree', async () => {
    const store = createTestStore()

    await expect(store.getState().openCodeServerTabInActiveWorkspace()).rejects.toThrow(
      'No worktree path is available'
    )
  })
})
