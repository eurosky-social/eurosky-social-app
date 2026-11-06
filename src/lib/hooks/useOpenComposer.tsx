import {useMemo} from 'react'
import {Trans} from '@lingui/react/macro'

import {useRequireEmailVerification} from '#/lib/hooks/useRequireEmailVerification'
import {
  type ComposerOpts,
  useOpenComposer as useRootOpenComposer,
} from '#/state/shell/composer'
import {canOpenComposer} from '#/features/product/publishing'

export function useOpenComposer() {
  const {openComposer} = useRootOpenComposer()
  const requireEmailVerification = useRequireEmailVerification()
  return useMemo(() => {
    const openWithAuth = requireEmailVerification(openComposer, {
      instructions: [
        <Trans key="pre-compose">
          Before creating a post or replying, you must first verify your email.
        </Trans>,
      ],
    })
    return {
      openComposer(opts: ComposerOpts) {
        /* Check before authentication so unavailable actions never prompt login. */
        if (!canOpenComposer(opts)) {
          opts.onClose?.()
          return
        }
        openWithAuth(opts)
      },
    }
  }, [openComposer, requireEmailVerification])
}
