import type { TabCreateMenuOption } from './tab-create-menu-options'
import type { BuiltInWindowsTerminalShell } from '../../../../shared/windows-terminal-shell'

export type TabCreateMenuOptionHandlers = {
  onNewTerminalTab: () => void
  onNewTerminalShell: (shell: BuiltInWindowsTerminalShell) => void
  onNewBrowserTab: () => void
  onNewCodeServerTab?: () => void
  onNewDevinCloudTab?: () => void
  onNewFileTab?: () => void
  onOpenFileTab?: () => void
  onNewSimulatorTab?: () => void
}

export function selectTabCreateMenuOption(
  option: TabCreateMenuOption,
  handlers: TabCreateMenuOptionHandlers
): void {
  switch (option.kind) {
    case 'new-terminal':
      handlers.onNewTerminalTab()
      break
    case 'new-terminal-shell':
      if (option.shell) {
        handlers.onNewTerminalShell(option.shell)
      }
      break
    case 'new-browser':
      handlers.onNewBrowserTab()
      break
    case 'new-code-server':
      handlers.onNewCodeServerTab?.()
      break
    case 'new-devin-cloud':
      handlers.onNewDevinCloudTab?.()
      break
    case 'new-markdown':
      handlers.onNewFileTab?.()
      break
    case 'open-markdown':
      handlers.onOpenFileTab?.()
      break
    case 'new-simulator':
    case 'go-to-simulator':
      handlers.onNewSimulatorTab?.()
      break
  }
}
