import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'

type EmbeddedAppUrlSettingProps = {
  title: string
  description: string
  savedMessage: string
  keywords: readonly string[]
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSave: (url: string | null) => void
}

export function EmbeddedAppUrlSetting({
  title,
  description,
  savedMessage,
  keywords,
  value,
  placeholder,
  onChange,
  onSave
}: EmbeddedAppUrlSettingProps): React.JSX.Element {
  return (
    <SearchableSetting
      title={title}
      description={description}
      keywords={[...keywords]}
      className="flex items-start justify-between gap-4 py-2"
    >
      <div className="min-w-0 shrink space-y-0.5">
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <form
        className="flex shrink-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (!trimmed) {
            onSave(null)
            return
          }
          if (!/^https?:\/\//.test(trimmed)) {
            toast.error(
              translate(
                'auto.components.settings.CodeServerUrlSetting.invalid',
                'Enter an http:// or https:// URL.'
              )
            )
            return
          }
          onSave(trimmed.replace(/\/+$/, ''))
          toast.success(savedMessage)
        }}
      >
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="h-7 w-52 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="h-7 text-xs">
          {translate('auto.components.settings.CodeServerUrlSetting.save', 'Save')}
        </Button>
      </form>
    </SearchableSetting>
  )
}
