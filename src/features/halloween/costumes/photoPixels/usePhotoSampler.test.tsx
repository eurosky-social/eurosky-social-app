import {act, renderHook} from '@testing-library/react-native'

import {loadPhotoPixels} from './index'
import {type PhotoPixels} from './types'
import {samplePhoto, usePhotoSampler} from './usePhotoSampler'

jest.mock('#/features/halloween/costumes/photoPixels', () => ({
  loadPhotoPixels: jest.fn(),
}))
const red: PhotoPixels = {
  width: 1,
  height: 1,
  data: new Uint8Array([255, 0, 0, 255]),
}
const blue: PhotoPixels = {
  width: 1,
  height: 1,
  data: new Uint8Array([0, 0, 255, 255]),
}

it('samples RGBA pixels and ignores transparent/out-of-bounds locations', () => {
  expect(samplePhoto(red, {x: 32, y: 32})).toBe('#FF0000')
  expect(
    samplePhoto({...red, data: new Uint8Array([255, 0, 0, 0])}, {x: 32, y: 32}),
  ).toBeNull()
  expect(samplePhoto(red, {x: 64, y: 0})).toBeNull()
  expect(samplePhoto(null, {x: 0, y: 0})).toBeNull()
  expect(
    samplePhoto(
      {...red, data: new Uint8Array([255, 0, 0, 128])},
      {x: 32, y: 32},
      '#FFFFFF',
    ),
  ).toBe('#FF7F7F')
  expect(
    samplePhoto(
      {...red, data: new Uint8Array([255, 0, 0, 0])},
      {x: 32, y: 32},
      '#112233',
    ),
  ).toBe('#112233')
})

it('never exposes a stale photo after account/avatar changes or late responses', async () => {
  let resolveOld: (value: PhotoPixels) => void = () => {}
  jest.mocked(loadPhotoPixels).mockImplementation(uri =>
    uri === 'old'
      ? new Promise(resolve => {
          resolveOld = resolve
        })
      : Promise.resolve(blue),
  )
  const {result, rerender} = renderHook(
    ({uri}: {uri: string}) => usePhotoSampler(uri),
    {initialProps: {uri: 'old'}},
  )
  expect(result.current({x: 32, y: 32})).toBeNull()
  await act(async () => {
    rerender({uri: 'new'})
    await Promise.resolve()
  })
  expect(result.current({x: 32, y: 32})).toBe('#0000FF')
  await act(async () => {
    resolveOld(red)
    await Promise.resolve()
  })
  expect(result.current({x: 32, y: 32})).toBe('#0000FF')
})
