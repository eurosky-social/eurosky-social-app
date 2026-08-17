import {reloadAppAsync} from 'expo'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {clearPersistedQueryStorage} from '#/lib/persisted-query-storage'
import {useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'
import {IS_WEB} from '#/env'

export function NetworkServicesRestartRequiredPrompt({
  control,
}: {
  control: Prompt.PromptControlProps
}) {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const {accounts} = useSession()

  const restart = async () => {
    /* Service responses share query keys, so none may survive the switch. */
    queryClient.clear()
    const cacheIds = new Set([
      'logged-out',
      ...accounts.map(account => account.did),
    ])
    await Promise.all([...cacheIds].map(clearPersistedQueryStorage))

    if (IS_WEB) {
      window.location.reload()
    } else {
      await reloadAppAsync()
    }
  }

  return (
    <Prompt.Basic
      control={control}
      title={l`Restart required`}
      description={l`Restart the app to use the selected content service.`}
      cancelButtonCta={l`Later`}
      confirmButtonCta={l`Restart`}
      onConfirm={() => void restart()}
    />
  )
}
