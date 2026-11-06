import {h} from 'preact'

import {VerifiedCheck, VerifierCheck} from '#/icons/Lucide'

export {VerifiedCheck, VerifierCheck}

export function VerificationCheck({
  verifier,
  ...rest
}: {
  verifier: boolean
  size: number
  className?: string
}) {
  return verifier ? <VerifierCheck {...rest} /> : <VerifiedCheck {...rest} />
}
