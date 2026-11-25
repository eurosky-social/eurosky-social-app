/** Query key of a video post's moments (`network.eurosky.feed.getMoments`). */
export const momentsQueryKey = (videoPostUri: string) => [
  'media-time-moments',
  videoPostUri,
]

/** Query key of a feed post's moment counts (`getMomentSummaries`). */
export const momentSummaryQueryKey = (postUri: string) => [
  'media-time-moment-summary',
  postUri,
]
