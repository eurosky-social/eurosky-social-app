import {PUBLISHERS} from './publishers'

/** Only registered publisher identities and the active account's real follow state. */
export function followedPublisherDids(
  profiles: readonly {
    did: string
    viewer?: {
      following?: string
      blocking?: string
      blockedBy?: boolean
      blockingByList?: unknown
    }
  }[],
) {
  return PUBLISHERS.filter(publisher =>
    profiles.some(
      profile =>
        profile.did === publisher.did &&
        !!profile.viewer?.following &&
        !profile.viewer.blocking &&
        !profile.viewer.blockedBy &&
        !profile.viewer.blockingByList,
    ),
  ).map(publisher => publisher.did)
}
