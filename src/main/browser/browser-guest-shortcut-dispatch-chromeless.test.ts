import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  screen: { getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })) },
  webContents: { fromId: vi.fn() }
}))

import {
  forwardGuestShortcutInput,
  type GuestShortcutForwardContext
} from './browser-guest-shortcut-dispatch'

// Mod resolves to Control on the linux CI platform these tests run on.
function modKey(key: string, code: string, extra: Partial<Electron.Input> = {}): Electron.Input {
  return {
    type: 'keyDown',
    key,
    code,
    control: true,
    alt: false,
    shift: false,
    meta: false,
    isAutoRepeat: false,
    ...extra
  } as Electron.Input
}

function makeHarness(chromeless: boolean): {
  ctx: GuestShortcutForwardContext
  send: ReturnType<typeof vi.fn>
  event: Electron.Event & { preventDefault: ReturnType<typeof vi.fn> }
} {
  const send = vi.fn()
  const event = { preventDefault: vi.fn() } as unknown as Electron.Event & {
    preventDefault: ReturnType<typeof vi.fn>
  }
  const ctx: GuestShortcutForwardContext = {
    browserTabId: 'page-1',
    resolveRenderer: () => ({ send }) as unknown as Electron.WebContents,
    resolveWorkspaceId: () => 'workspace-1',
    isChromelessGuest: () => chromeless,
    forwardBrowserPageZoom: vi.fn()
  }
  return { ctx, send, event }
}

describe('forwardGuestShortcutInput on chromeless guests', () => {
  it.each([
    ['browser.find (Mod+F)', modKey('f', 'KeyF'), 'ui:findInBrowserPage'],
    ['browser.reload (Mod+R)', modKey('r', 'KeyR'), 'ui:reloadBrowserPage'],
    ['tab.close (Mod+W)', modKey('w', 'KeyW'), 'ui:closeActiveTab'],
    ['browser.focusAddressBar (Mod+L)', modKey('l', 'KeyL'), 'ui:focusBrowserAddressBar']
  ])('lets the page keep %s', (_label, input, channel) => {
    const chromeful = makeHarness(false)
    expect(forwardGuestShortcutInput(chromeful.ctx, chromeful.event, input)).toBe(true)
    expect(chromeful.send).toHaveBeenCalledWith(channel, ...chromeful.send.mock.calls[0].slice(1))
    expect(chromeful.event.preventDefault).toHaveBeenCalled()

    const chromeless = makeHarness(true)
    expect(forwardGuestShortcutInput(chromeless.ctx, chromeless.event, input)).toBe(false)
    expect(chromeless.send).not.toHaveBeenCalled()
    expect(chromeless.event.preventDefault).not.toHaveBeenCalled()
  })

  it('keeps hard reload as the chromeless escape hatch', () => {
    const { ctx, send, event } = makeHarness(true)
    const handled = forwardGuestShortcutInput(ctx, event, modKey('R', 'KeyR', { shift: true }))
    expect(handled).toBe(true)
    expect(send).toHaveBeenCalledWith('ui:hardReloadBrowserPage')
  })

  it('still intercepts tab creation chords on chromeless guests', () => {
    const { ctx, send, event } = makeHarness(true)
    const handled = forwardGuestShortcutInput(ctx, event, modKey('C', 'KeyC', { shift: true }))
    expect(handled).toBe(true)
    expect(send).toHaveBeenCalledWith('ui:newCodeServerTab')
  })

  it('treats an absent resolver as chromeful', () => {
    const { ctx, send, event } = makeHarness(false)
    delete (ctx as { isChromelessGuest?: unknown }).isChromelessGuest
    const handled = forwardGuestShortcutInput(ctx, event, modKey('w', 'KeyW'))
    expect(handled).toBe(true)
    expect(send).toHaveBeenCalledWith('ui:closeActiveTab')
  })
})
