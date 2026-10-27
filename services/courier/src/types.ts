export type Platform = 'ios' | 'android'

/**
 * One device registered to receive pushes for one account. A phone signed in
 * to several accounts holds the same token once per account.
 */
export type Device = {
  did: string
  token: string
  appId: string
  platform: Platform
  ageRestricted: boolean
}

/**
 * Persistence for device registrations.
 */
export type TokenStore = {
  register(device: Device): Promise<void>
  unregister(device: Pick<Device, 'did' | 'token' | 'appId'>): Promise<void>
  setAgeRestricted(did: string, ageRestricted: boolean): Promise<void>
  devicesFor(dids: string[]): Promise<Device[]>
  /**
   * Forgets a token Apple or Google reported as dead, for every account on
   * the device. With `invalidSince`, a registration renewed after that moment
   * is kept: the app re-registered the token after the provider's verdict.
   */
  removeToken(token: string, invalidSince?: Date): Promise<number>
  ping(): Promise<void>
  close(): Promise<void>
}

/**
 * Outcome of a single send to Apple or Google.
 */
export type SendResult =
  | {ok: true}
  | {
      ok: false
      /**
       * The provider says this token will never work again.
       */
      invalidToken: boolean
      /**
       * Worth trying again shortly (rate limits, outages, dropped
       * connections).
       */
      retryable: boolean
      reason: string
      invalidSince?: Date
    }
