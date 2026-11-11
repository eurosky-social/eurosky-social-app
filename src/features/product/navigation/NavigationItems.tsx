import {Children, Fragment, isValidElement} from 'react'

import {type NavigationId} from '#/config/navigation'
import {type NavigationDestination} from './destinations'

/** Preserve specialized platform controls without hardcoding their order or visibility. */
export function NavigationItems({
  destinations,
  children,
  renderItem,
  renderBefore,
}: {
  destinations: readonly NavigationDestination[]
  children?: React.ReactNode
  renderItem: (destination: NavigationDestination) => React.ReactNode
  /** Content placed ahead of an item, such as a group heading. */
  renderBefore?: (
    destination: NavigationDestination,
    index: number,
  ) => React.ReactNode
}) {
  const slots = new Map(
    Children.toArray(children)
      .filter(
        isValidElement<{
          id: NavigationId
          children: React.ReactNode
        }>,
      )
      .map(child => [child.props.id, child.props.children]),
  )
  return destinations.map((destination, index) => (
    <Fragment key={destination.id}>
      {renderBefore?.(destination, index)}
      {slots.has(destination.id)
        ? slots.get(destination.id)
        : renderItem(destination)}
    </Fragment>
  ))
}

/** A platform-specific replacement for a destination's default button. */
export function NavigationSlot({
  children,
}: {
  id: NavigationId
  children: React.ReactNode
}) {
  return children
}
