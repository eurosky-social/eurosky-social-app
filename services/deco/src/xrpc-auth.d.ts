export class ServiceJwtVerifier {
  constructor(options: {
    acceptAudiences: string[]
    maxAge?: number
    clockLeeway?: number
    resolver: unknown
  })
  verifyRequest(
    request: Request,
    options: { lxm: string },
  ): Promise<{ issuer: string }>
}
