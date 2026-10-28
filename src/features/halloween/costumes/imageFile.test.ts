import {File, Paths} from 'expo-file-system'

import {createCostumeImageFile} from './imageFile'

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: {cache: {uri: 'file:///cache/'}},
}))
jest.mock('nanoid/non-secure', () => ({nanoid: () => 'test'}))

const file = {
  uri: 'file:///cache/costume-test.png',
  exists: false,
  create: jest.fn(() => {
    file.exists = true
  }),
  write: jest.fn<Promise<void>, [Uint8Array]>(),
  delete: jest.fn(() => {
    file.exists = false
  }),
}

beforeEach(() => {
  jest.clearAllMocks()
  file.exists = false
  file.write.mockReset()
  jest.mocked(File).mockImplementation(() => file as unknown as File)
})

it('writes PNG bytes directly to the scoped cache and retains them until disposal', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255])
  const image = await createCostumeImageFile(bytes)

  expect(File).toHaveBeenCalledWith(Paths.cache, 'costume-test.png')
  expect(file.create).toHaveBeenCalledWith({intermediates: true})
  expect(file.write).toHaveBeenCalledWith(bytes)
  expect(image.uri).toBe(file.uri)
  expect(file.delete).not.toHaveBeenCalled()

  image.dispose()
  image.dispose()
  expect(file.delete).toHaveBeenCalledTimes(1)
})

it('waits for the native write to finish before exposing the upload URI', async () => {
  let finish!: () => void
  file.write.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve
    }),
  )
  const ready = jest.fn()
  const pending = createCostumeImageFile(new Uint8Array([137])).then(ready)

  await Promise.resolve()
  expect(ready).not.toHaveBeenCalled()
  finish()
  await pending
  expect(ready).toHaveBeenCalledWith({
    uri: file.uri,
    dispose: expect.any(Function),
  })
})

it('removes a partially written image and propagates the write failure', async () => {
  const error = new Error('Disk full')
  file.write.mockRejectedValue(error)

  await expect(createCostumeImageFile(new Uint8Array([137]))).rejects.toBe(
    error,
  )
  expect(file.delete).toHaveBeenCalledTimes(1)
  expect(file.exists).toBe(false)
})

it('does not return an upload URI when the cache file cannot be created', async () => {
  const error = new Error('Cache unavailable')
  file.create.mockImplementationOnce(() => {
    throw error
  })

  await expect(createCostumeImageFile(new Uint8Array([137]))).rejects.toBe(
    error,
  )
  expect(file.write).not.toHaveBeenCalled()
})
