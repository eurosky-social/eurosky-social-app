import {Img} from './Img.js'
import {PersonIcon} from './Lucide.js'

const SCALE = 3
const BASE_SIZE = 120
const PADDING = 4
const CONTENT_SCALE = (BASE_SIZE - PADDING * 2) / BASE_SIZE

export const AVATAR_BUBBLES_SIZE = BASE_SIZE * SCALE

type BubbleConfig = {size: number; x: number; y: number}

const LAYOUTS: Record<1 | 2 | 3 | 4, BubbleConfig[]> = {
  1: [
    {size: 76, x: 0, y: 0},
    {size: 76, x: 44, y: 44},
  ],
  2: [
    {size: 76, x: 0, y: 0},
    {size: 76, x: 44, y: 44},
  ],
  3: [
    {size: 68, x: 0.5, y: 0},
    {size: 56, x: 40.5, y: 64},
    {size: 46, x: 73.5, y: 20},
  ],
  4: [
    {size: 68, x: 1, y: 1},
    {size: 56, x: 63, y: 52},
    {size: 42, x: 17, y: 77},
    {size: 32, x: 75, y: 12},
  ],
}

export function AvatarBubbles(props: {images: (Buffer | null)[]}) {
  const count = Math.min(props.images.length, 4) as 1 | 2 | 3 | 4
  const layout = LAYOUTS[count] ?? LAYOUTS[2]

  const bubbles = layout.map((bubble, i) => ({
    ...bubble,
    image: props.images[i] ?? null,
  }))

  // For the 2-avi layout, render in reverse so the first (top-left) paints last (on top)
  if (count <= 2) {
    bubbles.reverse()
  }

  return (
    <div
      style={{
        display: 'flex',
        width: AVATAR_BUBBLES_SIZE,
        height: AVATAR_BUBBLES_SIZE,
        position: 'relative',
      }}>
      {bubbles.map((bubble, i) => (
        <AvatarBubble
          key={i}
          image={bubble.image}
          size={bubble.size * CONTENT_SCALE * SCALE}
          x={bubble.x * CONTENT_SCALE * SCALE + PADDING * SCALE}
          y={bubble.y * CONTENT_SCALE * SCALE + PADDING * SCALE}
        />
      ))}
    </div>
  )
}

function AvatarBubble(props: {
  image: Buffer | null
  size: number
  x: number
  y: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        left: props.x,
        top: props.y,
        width: props.size,
        height: props.size,
        borderRadius: '50%',
        overflow: 'hidden',
      }}>
      {props.image ? (
        <Img width="100%" height="100%" src={props.image} />
      ) : (
        <Placeholder size={props.size} />
      )}
    </div>
  )
}

function Placeholder(props: {size: number}) {
  const iconSize = props.size * 0.5
  const offset = (props.size - iconSize) / 2
  return (
    <div
      style={{
        display: 'flex',
        width: props.size,
        height: props.size,
        backgroundColor: '#b0b0b0',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <PersonIcon
        width={iconSize}
        height={iconSize}
        style={{position: 'absolute', left: offset, top: offset}}
      />
    </div>
  )
}
