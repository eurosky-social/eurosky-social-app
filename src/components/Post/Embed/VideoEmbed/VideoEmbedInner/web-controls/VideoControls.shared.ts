import type Hls from 'hls.js'

import {type VideoAudioState} from '../../VideoVolumeContext'

export type ControlsProps = {
  audio?: VideoAudioState
  controlsVisible?: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  hlsRef: React.RefObject<Hls | undefined | null>
  active: boolean
  setActive: () => void
  focused: boolean
  setFocused: (focused: boolean) => void
  onScreen: boolean
  fullscreenRef: React.RefObject<HTMLDivElement | null>
  hlsLoading: boolean
  hasSubtitleTrack: boolean
  isGif: boolean
  altText?: string
  updateCuePositions: (controlsVisible?: boolean) => void
}
