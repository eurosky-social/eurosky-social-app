import {useLingui} from '@lingui/react/macro'

import * as Prompt from '#/components/Prompt'
import {useRestartApp} from '#/features/appView/useRestartApp'

export function NetworkServicesRestartRequiredPrompt({
  control,
  description,
}: {
  control: Prompt.PromptControlProps
  description?: string
}) {
  const {t: l} = useLingui()
  const restart = useRestartApp()

  return (
    <Prompt.Basic
      control={control}
      title={l`Restart required`}
      description={
        description ?? l`Restart the app to use the selected content service.`
      }
      cancelButtonCta={l`Later`}
      confirmButtonCta={l`Restart`}
      onConfirm={() => void restart()}
    />
  )
}
