import * as MediaLibrary from 'expo-media-library/legacy'
import {fireEventAsync, render} from '@testing-library/react-native'

import {
  requestPhotoSavePermission,
  savePhotoToLibrary,
} from '#/lib/media/photo-library'
import {openCamera} from '#/lib/media/picker'
import {OpenCameraBtn} from './OpenCameraBtn'

jest.mock('#/env', () => ({
  IS_ANDROID: true,
  IS_NATIVE: true,
  IS_WEB_MOBILE: false,
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: () => 'Camera'}),
}))
jest.mock('#/lib/hooks/usePermissions', () => ({
  useCameraPermission: () => ({
    requestCameraAccessIfNeeded: () => Promise.resolve(true),
  }),
}))
jest.mock('#/lib/media/photo-library', () => ({
  requestPhotoSavePermission: jest.fn(() => Promise.resolve(true)),
  savePhotoToLibrary: jest.fn(() => Promise.resolve()),
}))
jest.mock('#/lib/media/picker', () => ({
  openCamera: jest.fn(() =>
    Promise.resolve({
      path: 'file:///cache/capture.jpg',
      mime: 'image/jpeg',
      size: 100,
      width: 100,
      height: 100,
    }),
  ),
}))
jest.mock('#/state/gallery', () => ({
  createComposerImage: jest.fn(() => Promise.resolve({id: 'capture'})),
}))
jest.mock('#/logger', () => ({logger: {warn: jest.fn()}}))
jest.mock('#/alf', () => ({
  atoms: {p_sm: {}},
  useTheme: () => ({atoms: {text_contrast_low: {}}}),
}))
jest.mock('#/components/Button', () => ({
  Button: 'Button',
}))
jest.mock('#/components/icons/Camera', () => ({
  Camera_Stroke2_Corner0_Rounded: () => null,
}))

beforeEach(() => {
  jest.clearAllMocks()
})

it('saves and attaches an Android capture without requesting library reads', async () => {
  const onAdd = jest.fn()
  const screen = render(<OpenCameraBtn onAdd={onAdd} />)

  await fireEventAsync.press(screen.getByTestId('openCameraButton'))

  expect(MediaLibrary.usePermissions).toHaveBeenCalledWith({
    granularPermissions: ['photo'],
    get: false,
  })
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(savePhotoToLibrary).toHaveBeenCalledWith('file:///cache/capture.jpg')
  expect(onAdd).toHaveBeenCalledWith([{id: 'capture'}])
})

it('still attaches the capture if saving the gallery copy fails', async () => {
  jest.mocked(savePhotoToLibrary).mockRejectedValueOnce(new Error('Disk full'))
  const onAdd = jest.fn()
  const screen = render(<OpenCameraBtn onAdd={onAdd} />)

  await fireEventAsync.press(screen.getByTestId('openCameraButton'))

  expect(onAdd).toHaveBeenCalledWith([{id: 'capture'}])
})

it('still attaches the capture when legacy write permission is denied', async () => {
  jest.mocked(requestPhotoSavePermission).mockResolvedValueOnce(false)
  const onAdd = jest.fn()
  const screen = render(<OpenCameraBtn onAdd={onAdd} />)

  await fireEventAsync.press(screen.getByTestId('openCameraButton'))

  expect(savePhotoToLibrary).not.toHaveBeenCalled()
  expect(onAdd).toHaveBeenCalledWith([{id: 'capture'}])
})

it('does not save anything when the camera is cancelled', async () => {
  jest.mocked(openCamera).mockResolvedValueOnce(undefined)
  const onAdd = jest.fn()
  const screen = render(<OpenCameraBtn onAdd={onAdd} />)

  await fireEventAsync.press(screen.getByTestId('openCameraButton'))

  expect(requestPhotoSavePermission).not.toHaveBeenCalled()
  expect(savePhotoToLibrary).not.toHaveBeenCalled()
  expect(onAdd).not.toHaveBeenCalled()
})
