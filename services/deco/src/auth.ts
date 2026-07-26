import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver'
// esm.sh currently publishes a broken transitive declaration URL for
// @atcute/crypto. Runtime code is bundled and pinned; this local declaration
// supplies the small verifier surface we use until that upstream issue clears.
// @ts-types="./xrpc-auth.d.ts"
import { ServiceJwtVerifier } from 'https://esm.sh/@atcute/xrpc-server@2.0.2/auth?bundle'

import { type DecoConfig } from './config.ts'
import { type CallerVerifier } from './types.ts'

const MAX_TOKEN_AGE_SECONDS = 3900
const CLOCK_LEEWAY_SECONDS = 60

export function createCallerVerifier(config: DecoConfig): CallerVerifier {
  const verifier = new ServiceJwtVerifier({
    acceptAudiences: [config.serviceDid],
    maxAge: MAX_TOKEN_AGE_SECONDS,
    clockLeeway: CLOCK_LEEWAY_SECONDS,
    resolver: new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver({ apiUrl: config.plcDirectoryUrl }),
        web: new WebDidDocumentResolver(),
      },
    }),
  })

  return {
    async verify(request, lxm) {
      if (config.devTrustDidHeader) {
        const did = request.headers.get('x-did')
        if (did?.startsWith('did:')) return did
      }
      const { issuer } = await verifier.verifyRequest(request, { lxm })
      return issuer
    },
  }
}
