import {Children, Fragment, isValidElement} from 'react'

import {type NavigationId} from '#/config/navigation'
import {type NavigationDestination} from './destinations'

/** Preserve specialized platform controls without hardcoding their order or visibility. */
export function NavigationItems({
  destinations,
  children,
  renderItem,
}: {
  destinations: readonly NavigationDestination[]
  children?: React.ReactNode
  renderItem: (destination: NavigationDestination) => React.ReactNode
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
  return destinations.map(destination => (
    <Fragment key={destination.id}>
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
