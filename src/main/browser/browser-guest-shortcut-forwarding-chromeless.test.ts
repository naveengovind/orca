import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  screen: { getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })) },
  webContents: { fromId: vi.fn() }
}))

import { setupGuestShortcutForwarding } from './browser-guest-shortcut-forwarding'

describe('setupGuestShortcutForwarding chromeless guests', () => {
  const browserTabId = 'tab-1'
  let rendererSendMock: ReturnType<typeof vi.fn>
  let guestOnMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rendererSendMock = vi.fn()
    guestOnMock = vi.fn()
  })

  it('lets a chromeless guest keep Ctrl+Tab (its own editor switcher)', () => {
    setupGuestShortcutForwarding({
      browserTabId,
      guest: { on: guestOnMock, off: vi.fn() } as unknown as Electron.WebContents,
      resolveRenderer: () => ({ send: rendererSendMock }) as unknown as Electron.WebContents,
      isChromelessGuest: () => true
    })

    const handler = guestOnMock.mock.calls.find((call) => call[0] === 'before-input-event')?.[1] as
      | ((event: Electron.Event, input: Electron.Input) => void)
      | undefined
    expect(handler).toBeTypeOf('function')
    const preventDefault = vi.fn()
    handler!(
      { preventDefault } as unknown as Electron.Event,
      {
        type: 'keyDown',
        alt: false,
        meta: false,
        control: true,
        shift: false,
        code: 'Tab',
        key: 'Tab'
      } as Electron.Input
    )

    expect(preventDefault).not.toHaveBeenCalled()
    expect(rendererSendMock).not.toHaveBeenCalled()
  })
})
