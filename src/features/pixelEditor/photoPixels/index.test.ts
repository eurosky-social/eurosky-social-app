import {Image, type ImageRef} from 'expo-image'
import {ImageManipulator} from 'expo-image-manipulator'
import {toBase64} from '@atproto/lex'
import {encode} from 'upng-js'

import {loadPhotoPixels} from './index'

jest.mock('expo-image', () => ({Image: {loadAsync: jest.fn()}}))
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {manipulate: jest.fn()},
  SaveFormat: {PNG: 'png'},
}))

it('center-crops/resizes the original, decodes a tiny PNG, and releases all native resources', async () => {
  const data = new Uint8Array(64 * 64 * 4)
  data.set([18, 52, 86, 255])
  const rendered = {
    release: jest.fn(),
    saveAsync: jest.fn(() =>
      Promise.resolve({
        uri: 'file://sample.png',
        base64: toBase64(new Uint8Array(encode([data.buffer], 64, 64, 0))),
      }),
    ),
  }
  const context = {
    crop: jest.fn(),
    resize: jest.fn(),
    renderAsync: jest.fn(() => Promise.resolve(rendered)),
    release: jest.fn(),
  }
  context.crop.mockReturnValue(context)
  context.resize.mockReturnValue(context)
  const image = {width: 128, height: 256, scale: 1, release: jest.fn()}
  jest.mocked(Image.loadAsync).mockResolvedValue(image as unknown as ImageRef)
  jest
    .mocked(ImageManipulator.manipulate)
    .mockReturnValue(
      context as unknown as ReturnType<typeof ImageManipulator.manipulate>,
    )
  const result = await loadPhotoPixels('https://example.com/avatar')
  expect(context.crop).toHaveBeenCalledWith({
    originX: 0,
    originY: 64,
    width: 128,
    height: 128,
  })
  expect(context.resize).toHaveBeenCalledWith({width: 64, height: 64})
  expect([...result.data.slice(0, 4)]).toEqual([18, 52, 86, 255])
  expect(image.release).toHaveBeenCalledTimes(1)
  expect(context.release).toHaveBeenCalledTimes(1)
  expect(rendered.release).toHaveBeenCalledTimes(1)
})

it('also releases the loaded image if native manipulation cannot start', async () => {
  const image = {width: 64, height: 64, scale: 1, release: jest.fn()}
  jest.mocked(Image.loadAsync).mockResolvedValue(image as unknown as ImageRef)
  jest.mocked(ImageManipulator.manipulate).mockImplementation(() => {
    throw new Error('Unsupported source')
  })
  await expect(loadPhotoPixels('https://example.com/avatar')).rejects.toThrow(
    'Unsupported source',
  )
  expect(image.release).toHaveBeenCalledTimes(1)
})
