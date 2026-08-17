export type AppViewPreference = {
  /** Direct URL used for unauthenticated AppView requests. */
  url: string
  /** Service DID used by the PDS to proxy authenticated AppView requests. */
  did: string
}
