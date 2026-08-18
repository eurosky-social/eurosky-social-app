import {type AppViewPreference} from '#/features/appView/types'

export const APP_VIEW_TRANSFER_COLLECTIONS = [
  'mutedAccounts',
  'mutedLists',
  'bookmarks',
  'activitySubscriptions',
  'notificationPreferences',
] as const

export type AppViewTransferCollectionId =
  (typeof APP_VIEW_TRANSFER_COLLECTIONS)[number]

export type AppViewTransferCollectionStatus =
  | 'pending'
  | 'countingDestination'
  | 'countingSource'
  | 'transferring'
  | 'countingFinal'
  | 'complete'
  | 'unsupported'
  | 'failed'

export type AppViewTransferCollectionProgress = {
  status: AppViewTransferCollectionStatus
  sourceCount: number
  sourceScanned?: boolean
  processedCount?: number
  transferredCount: number
  destinationBefore?: number
  destinationScanned?: boolean
  destinationAfter?: number
  unsupportedAt?: 'source' | 'destination'
  /** Safe XRPC details retained for troubleshooting without item data. */
  failureAt?: 'source' | 'destination'
  failureStatus?: number
  failureName?: string
}

export type AppViewTransferCheckpoint = {
  version: 1
  accountDid: string
  source: AppViewPreference
  destination: AppViewPreference
  selectedCollections: AppViewTransferCollectionId[]
  status: 'running' | 'paused' | 'complete'
  startedAt: string
  updatedAt: string
  collections: Partial<
    Record<AppViewTransferCollectionId, AppViewTransferCollectionProgress>
  >
}
