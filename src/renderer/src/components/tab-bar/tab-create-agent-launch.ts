import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'

export function launchAgentFromNewTabEntry(input: {
  agent: TuiAgent
  agentLabel: string | undefined
  worktreeId: string
  groupId: string | undefined
  queueTerminalTabFocus: (tabId: string) => void
  queueNewActiveTerminalFocus: () => void
}): void {
  const result = launchAgentInNewTab({
    agent: input.agent,
    worktreeId: input.worktreeId,
    groupId: input.groupId,
    launchSource: 'tab_bar_quick_launch'
  })
  if (!result) {
    toast.error(
      translate(
        'auto.components.tab.bar.TabBar.ab589350e5',
        'Could not build launch command for {{value0}}.',
        { value0: input.agentLabel ?? input.agent }
      )
    )
    return
  }
  if (result.tabId) {
    input.queueTerminalTabFocus(result.tabId)
    return
  }
  input.queueNewActiveTerminalFocus()
}
