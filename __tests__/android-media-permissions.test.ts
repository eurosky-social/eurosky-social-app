import createConfig from '../app.config'

it('blocks dependency-provided media read permissions in Android builds', () => {
  const {expo} = createConfig({name: 'mu', slug: 'mu-social'})
  expect(expo.android?.blockedPermissions).toEqual(
    expect.arrayContaining([
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.ACCESS_MEDIA_LOCATION',
    ]),
  )
  expect(expo.android?.blockedPermissions).not.toContain(
    'android.permission.WRITE_EXTERNAL_STORAGE',
  )
})
