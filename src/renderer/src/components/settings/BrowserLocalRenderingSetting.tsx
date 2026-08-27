import { useAppStore } from '../../store'
import { translate } from '@/i18n/i18n'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

// Electron-only preference: new user-created browser tabs render in a local
// webview instead of streaming from the paired remote runtime. Pages served
// only on the remote host (e.g. localhost dev servers) need a port forward.
export function BrowserLocalRenderingSetting(): React.JSX.Element {
  const preferLocal = useAppStore((s) => s.browserPreferLocalRendering)
  const setPreferLocal = useAppStore((s) => s.setBrowserPreferLocalRendering)
  const title = translate(
    'auto.components.settings.BrowserLocalRenderingSetting.title',
    'Open Browser Tabs Locally'
  )
  const description = translate(
    'auto.components.settings.BrowserLocalRenderingSetting.description',
    'Render new browser tabs on this device instead of the remote Orca server. Existing remote tabs stay remote. Pages served only on the server (e.g. its localhost ports) need a port forward.'
  )

  return (
    <SearchableSetting
      title={title}
      description={description}
      keywords={['browser', 'local', 'remote', 'runtime', 'render', 'stream', 'webview', 'server']}
    >
      <SettingsSwitchRow
        label={title}
        description={description}
        checked={preferLocal}
        onChange={() => setPreferLocal(!preferLocal)}
      />
    </SearchableSetting>
  )
}
