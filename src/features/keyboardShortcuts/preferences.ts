import {device, useStorage} from '#/storage'

const STORAGE_KEY: ['keyboardShortcutsEnabled'] = ['keyboardShortcutsEnabled']

export function useKeyboardShortcutsPreference() {
  const [storedEnabled, setStoredEnabled] = useStorage(device, STORAGE_KEY)

  return {
    enabled: storedEnabled !== false,
    setEnabled: setStoredEnabled,
  }
}
