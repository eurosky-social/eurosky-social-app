import {Component, createRef} from 'react'

type Props = {
  children: React.ReactNode
  enabled: boolean
  layoutKey: string
}
type Frames = Map<string, DOMRect>

/** Capture before DOM mutations so FLIP also works across remounted newspaper columns. */
export class StoryTransitions extends Component<Props> {
  private root = createRef<HTMLDivElement>()
  private animations = new Set<Animation>()

  private stories() {
    return (
      this.root.current?.querySelectorAll<HTMLElement>(
        '[data-editorial-story]',
      ) ?? []
    )
  }

  getSnapshotBeforeUpdate(previous: Props): Frames | null {
    if (
      !this.props.enabled ||
      !previous.enabled ||
      this.props.layoutKey === previous.layoutKey ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return null
    return new Map(
      [...this.stories()].map(node => [
        node.dataset.editorialStory!,
        node.getBoundingClientRect(),
      ]),
    )
  }

  componentDidUpdate(_previous: Props, _state: unknown, frames: Frames | null) {
    if (!frames) return
    /* Sample the current visual position before cancelling interrupted animations. */
    for (const animation of this.animations) animation.cancel()
    this.animations.clear()
    for (const node of this.stories()) {
      const before = frames.get(node.dataset.editorialStory!)
      const after = node.getBoundingClientRect()
      if (!after.width || !after.height) continue
      let animation: Animation
      if (!before) {
        animation = node.animate([{opacity: 0}, {opacity: 1}], {
          duration: 180,
          easing: 'ease-out',
        })
      } else {
        const x = before.left - after.left
        const y = before.top - after.top
        const scaleX = before.width / after.width
        const scaleY = before.height / after.height
        if (
          Math.abs(x) < 0.5 &&
          Math.abs(y) < 0.5 &&
          Math.abs(scaleX - 1) < 0.005 &&
          Math.abs(scaleY - 1) < 0.005
        )
          continue
        animation = node.animate(
          [
            {
              transformOrigin: 'top left',
              transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`,
            },
            {
              transformOrigin: 'top left',
              transform: 'translate(0, 0) scale(1, 1)',
            },
          ],
          {duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)'},
        )
      }
      this.animations.add(animation)
      void animation.finished.then(
        () => this.animations.delete(animation),
        () => this.animations.delete(animation),
      )
    }
  }

  componentWillUnmount() {
    for (const animation of this.animations) animation.cancel()
  }

  render() {
    return (
      <div ref={this.root} style={{display: 'contents'}}>
        {this.props.children}
      </div>
    )
  }
}
