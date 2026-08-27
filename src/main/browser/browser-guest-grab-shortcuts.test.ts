import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({}))

import { setupGrabShortcutForwarding } from './browser-guest-grab-shortcuts'

type Handler = (event: Electron.Event, input: Electron.Input) => void

function makeHarness(chromeless: boolean): {
  handler: Handler
  send: ReturnType<typeof vi.fn>
  executeJavaScript: ReturnType<typeof vi.fn>
} {
  const send = vi.fn()
  const executeJavaScript = vi.fn().mockResolvedValue(true)
  const listeners: Handler[] = []
  const guest = {
    on: (_event: string, handler: Handler) => listeners.push(handler),
    off: vi.fn(),
    executeJavaScript
  } as unknown as Electron.WebContents

  setupGrabShortcutForwarding({
    browserTabId: 'page-1',
    guest,
    resolveRenderer: () => ({ send }) as unknown as Electron.WebContents,
    hasActiveGrabOp: () => false,
    isChromelessGuest: () => chromeless
  })
  return { handler: listeners[0], send, executeJavaScript }
}

function modC(): Electron.Input {
  return {
    type: 'keyDown',
    key: 'c',
    code: 'KeyC',
    control: true,
    alt: false,
    shift: false,
    meta: false,
    isAutoRepeat: false
  } as Electron.Input
}

describe('setupGrabShortcutForwarding', () => {
  it('toggles grab mode for a chromeful guest when copy would not apply', async () => {
    const { handler, send, executeJavaScript } = makeHarness(false)
    const event = { preventDefault: vi.fn() } as unknown as Electron.Event

    handler(event, modC())
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith('browser:grabModeToggle', 'page-1'))
    expect(executeJavaScript).toHaveBeenCalled()
  })

  it('never intercepts Mod+C for a chromeless guest', () => {
    const { handler, send, executeJavaScript } = makeHarness(true)
    const event = { preventDefault: vi.fn() } as unknown as Electron.Event

    handler(event, modC())
    expect(executeJavaScript).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
