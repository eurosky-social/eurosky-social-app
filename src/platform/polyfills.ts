import 'fast-text-encoding'

/*
 * React Native's AbortSignal comes from the abort-controller package, which
 * does not implement the standard throwIfAborted() method. The AT Protocol lex
 * client calls that method whenever a request receives an AbortSignal.
 */
if (!AbortSignal.prototype.throwIfAborted) {
  AbortSignal.prototype.throwIfAborted = function throwIfAborted() {
    if (this.aborted) {
      if (this.reason !== undefined) {
        throw this.reason
      }
      const error = new Error('This operation was aborted')
      error.name = 'AbortError'
      throw error
    }
  }
}

export {}
