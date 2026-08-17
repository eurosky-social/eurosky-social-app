import {EventEmitter} from 'eventemitter3'

const emitter = new EventEmitter()
const OPEN_SHORTCUTS = 'open-shortcuts'

export function emitOpenKeyboardShortcuts() {
  emitter.emit(OPEN_SHORTCUTS)
}

export function listenOpenKeyboardShortcuts(listener: () => void) {
  emitter.on(OPEN_SHORTCUTS, listener)
  return () => {
    emitter.off(OPEN_SHORTCUTS, listener)
  }
}
