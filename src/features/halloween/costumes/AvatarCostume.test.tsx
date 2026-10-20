import {render} from '@testing-library/react-native'

import {AvatarCostume} from './AvatarCostume'
import {createCostume} from './model'
import {PixelLayer} from './PixelLayer'

let mockActive = true
const mockCostumes = {'did:plc:alice': createCostume()}
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))
jest.mock('#/features/halloween/costumes/state', () => ({
  useCostumes: () => ({costumes: mockCostumes}),
}))
jest.mock('#/alf', () => ({atoms: {}}))

it('renders only the matching DID and respects seasonal opt-out/expiry', () => {
  mockActive = true
  const screen = render(
    <AvatarCostume did="did:plc:alice" size={40} borderRadius={20} />,
  )
  expect(
    screen.getByTestId('costumePixelLayer', {includeHiddenElements: true}),
  ).toBeTruthy()
  screen.rerender(
    <AvatarCostume did="did:plc:bob" size={40} borderRadius={20} />,
  )
  expect(
    screen.queryByTestId('costumePixelLayer', {includeHiddenElements: true}),
  ).toBeNull()
  mockActive = false
  screen.rerender(
    <AvatarCostume did="did:plc:alice" size={40} borderRadius={20} />,
  )
  expect(
    screen.queryByTestId('costumePixelLayer', {includeHiddenElements: true}),
  ).toBeNull()
})

it('keeps transparent artwork non-interactive and clips to the avatar shape', () => {
  const screen = render(
    <PixelLayer costume={createCostume()} size={56} borderRadius={8} />,
  )
  const layer = screen.getByTestId('costumePixelLayer', {
    includeHiddenElements: true,
  })
  expect(layer.props.pointerEvents).toBe('none')
  expect(layer.props.accessibilityElementsHidden).toBe(true)
  expect(layer.props.style).toEqual(expect.arrayContaining([{borderRadius: 8}]))
})
