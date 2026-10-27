import {decode, toRGBA8} from 'upng-js'

import {createCostume} from './model'
import {loadPhotoPixels} from './photoPixels'
import {COSTUME_IMAGE_SIZE, renderCostume} from './render'

jest.mock('./photoPixels', () => ({loadPhotoPixels: jest.fn()}))
const loadPhoto = jest.mocked(loadPhotoPixels)

it('flattens pixel art over the photo into a square PNG at avatar resolution', async () => {
  const size = COSTUME_IMAGE_SIZE
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < data.length; i += 4) data.set([20, 40, 60, 255], i)
  loadPhoto.mockResolvedValue({width: size, height: size, data})
  const costume = createCostume()
  costume.palette = ['#FF0000']
  costume.pixels[0] = 0
  const bytes = await renderCostume(costume, 'https://original')
  const png = decode(bytes.buffer)
  const pixels = new Uint8Array(toRGBA8(png)[0])
  expect([png.width, png.height]).toEqual([512, 512])
  expect([...pixels.slice(0, 4)]).toEqual([255, 0, 0, 255])
  expect([...pixels.slice(8 * 4, 8 * 4 + 4)]).toEqual([20, 40, 60, 255])
  expect(loadPhoto).toHaveBeenCalledWith('https://original', 512)
})

it('supports accounts with no photo but never silently drops a photo that failed to load', async () => {
  const bytes = await renderCostume(createCostume())
  expect(decode(bytes.buffer).width).toBe(512)
  loadPhoto.mockRejectedValueOnce(new Error('CORS'))
  await expect(
    renderCostume(createCostume(), 'https://blocked'),
  ).rejects.toThrow('CORS')
})
