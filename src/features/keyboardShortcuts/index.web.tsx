import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useHotkeysContext} from 'react-hotkeys-hook'

import {emitSoftReset} from '#/state/events'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {navigate} from '#/Navigation'
import {router} from '#/routes'
import {listenOpenKeyboardShortcuts} from './events'
import {KeyboardShortcutsDialog} from './KeyboardShortcutsDialog'
import {
  clickPost,
  clickPostAction,
  getInitialVisiblePost,
  getNavigablePosts,
  getPostAnnouncement,
  getPostHref,
  isPostVisible,
  type PostAction,
  setPostSelected,
} from './postNavigation.web'
import {useKeyboardShortcutsPreference} from './preferences'

const CHORD_TIMEOUT_MS = 1000
const APP_CHARACTER_KEYS = new Set([
  '?',
  '/',
  '.',
  'g',
  'n',
  'h',
  'j',
  'k',
  'o',
  'r',
  'l',
  't',
  'b',
  's',
])

const POST_ACTIONS: Partial<Record<string, PostAction>> = {
  o: 'media',
  r: 'reply',
  l: 'like',
  t: 'repost',
  s: 'share',
}

type FeedReturnTarget = {
  postUri: string
  sourcePath: string
  destinationPath: string
  viewportTop: number
}

function getCurrentPath() {
  return window.location.pathname + window.location.search
}

export function KeyboardShortcuts() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const {enabled} = useKeyboardShortcutsPreference()
  const {activeScopes, disableScope, enableScope} = useHotkeysContext()
  const dialogControl = Dialog.useDialogControl()
  const selectedPostRef = useRef<HTMLElement | null>(null)
  const originalTabIndexRef = useRef<string | null>(null)
  const pendingChordRef = useRef<string | null>(null)
  const chordTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const openedPostTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const feedReturnTargetsRef = useRef<FeedReturnTarget[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const globalScopeActive =
    activeScopes.includes('*') || activeScopes.includes('global')

  const clearChord = () => {
    pendingChordRef.current = null
    clearTimeout(chordTimeoutRef.current)
  }

  const clearSelection = (updateAnnouncement = true) => {
    const selected = selectedPostRef.current
    if (!selected) return false

    setPostSelected(selected, false)
    if (originalTabIndexRef.current === null) {
      selected.removeAttribute('tabindex')
    } else {
      selected.setAttribute('tabindex', originalTabIndexRef.current)
    }
    if (document.activeElement === selected) selected.blur()

    selectedPostRef.current = null
    originalTabIndexRef.current = null
    if (updateAnnouncement) setAnnouncement('')
    return true
  }

  const selectPost = (post: HTMLElement, scrollIntoView = true) => {
    if (selectedPostRef.current === post) return

    clearSelection()
    selectedPostRef.current = post
    originalTabIndexRef.current = post.getAttribute('tabindex')
    setPostSelected(post, true)
    post.setAttribute('tabindex', '-1')
    post.focus({preventScroll: true})
    if (scrollIntoView) {
      post.scrollIntoView({
        block:
          post.getBoundingClientRect().height > window.innerHeight
            ? 'start'
            : 'center',
        inline: 'nearest',
      })
    }

    const summary = getPostAnnouncement(post)
    setAnnouncement(summary ? l`Selected post: ${summary}` : l`Selected post`)
  }

  const moveSelection = (direction: 1 | -1) => {
    const posts = getNavigablePosts()
    if (posts.length === 0) return false

    const selected = selectedPostRef.current
    if (!selected || !isPostVisible(selected)) {
      const initial = getInitialVisiblePost(posts)
      if (!initial) return false
      selectPost(initial)
      return true
    }

    const currentIndex = posts.indexOf(selected)
    if (currentIndex < 0) {
      const initial = getInitialVisiblePost(posts)
      if (!initial) return false
      selectPost(initial)
      return true
    }

    const nextIndex = Math.max(
      0,
      Math.min(posts.length - 1, currentIndex + direction),
    )
    selectPost(posts[nextIndex])
    return true
  }

  const getSelectedVisiblePost = () => {
    const selected = selectedPostRef.current
    return selected && isPostVisible(selected) ? selected : null
  }

  const selectOpenedPost = (target: FeedReturnTarget) => {
    clearTimeout(openedPostTimeoutRef.current)
    let attempts = 0

    const trySelect = () => {
      if (feedReturnTargetsRef.current.at(-1) !== target) return

      const path = getCurrentPath()
      if (path === target.destinationPath) {
        const post = getNavigablePosts().find(
          item =>
            item.dataset.keyboardNavigationPost === target.postUri &&
            item.dataset.testid?.startsWith('postThreadItem-by-'),
        )
        if (post) {
          selectPost(post)
          return
        }
      } else if (path !== target.sourcePath) {
        return
      }

      attempts += 1
      if (attempts < 100) {
        openedPostTimeoutRef.current = setTimeout(trySelect, 50)
      }
    }

    openedPostTimeoutRef.current = setTimeout(trySelect)
  }

  const openSelectedPost = () => {
    const selected = getSelectedVisiblePost()
    if (!selected) return false

    const href = getPostHref(selected)
    const postUri = selected.dataset.keyboardNavigationPost
    if (!href || !postUri) return false
    if (getCurrentPath() === href) return true

    const returnTarget: FeedReturnTarget = {
      postUri,
      sourcePath: getCurrentPath(),
      destinationPath: href,
      viewportTop: selected.getBoundingClientRect().top,
    }
    feedReturnTargetsRef.current.push(returnTarget)

    if (clickPost(selected)) {
      clearSelection()
      selectOpenedPost(returnTarget)
      return true
    }

    const [name, params] = router.matchPath(href)
    // @ts-expect-error Router.matchPath returns matching name and params as a correlated pair.
    void navigate(name, params)
    clearSelection()
    selectOpenedPost(returnTarget)
    return true
  }

  const restoreFeedSelection = () => {
    clearTimeout(openedPostTimeoutRef.current)
    const targets = feedReturnTargetsRef.current
    const target = targets.at(-1)
    if (!target || getCurrentPath() !== target.sourcePath) return

    let attempts = 0
    const tryRestore = () => {
      if (
        feedReturnTargetsRef.current.at(-1) !== target ||
        getCurrentPath() !== target.sourcePath
      ) {
        return
      }

      const post = getNavigablePosts().find(
        item => item.dataset.keyboardNavigationPost === target.postUri,
      )
      if (post) {
        const offset = post.getBoundingClientRect().top - target.viewportTop
        if (Math.abs(offset) > 1) {
          window.scrollBy({top: offset, behavior: 'auto'})
        }
        selectPost(post, false)
        targets.pop()
        return
      }

      attempts += 1
      if (attempts < 100) {
        restoreTimeoutRef.current = setTimeout(tryRestore, 50)
      }
    }

    restoreTimeoutRef.current = setTimeout(tryRestore)
  }

  const runPostAction = (action: PostAction) => {
    const selected = getSelectedVisiblePost()
    return selected ? clickPostAction(selected, action) : false
  }

  const goTo = (key: string) => {
    if (!hasSession) return false

    switch (key) {
      case 'h':
        void navigate('Home')
        break
      case 'w':
        void navigate('NewsFeed')
        break
      case 'e':
        void navigate('Search', {})
        break
      case 'n':
        void navigate('Notifications')
        break
      case 'c':
        void navigate('Messages', {})
        break
      case 'f':
        void navigate('Feeds')
        break
      case 'l':
        void navigate('Lists')
        break
      case 'b':
        void navigate('Bookmarks')
        break
      case 'p':
        if (!currentAccount) return false
        void navigate('Profile', {name: currentAccount.handle})
        break
      case 's':
        void navigate('Settings')
        break
      default:
        return false
    }

    clearTimeout(openedPostTimeoutRef.current)
    clearTimeout(restoreTimeoutRef.current)
    feedReturnTargetsRef.current = []
    clearSelection()
    return true
  }

  useEffect(() => {
    if (enabled && !dialogOpen) {
      enableScope('global')
    } else {
      disableScope('global')
    }
  }, [dialogOpen, disableScope, enableScope, enabled])

  useEffect(() => {
    if (!enabled && globalScopeActive) disableScope('global')
  }, [disableScope, enabled, globalScopeActive])

  useEffect(() => {
    if (enabled) return

    clearChord()
    clearTimeout(openedPostTimeoutRef.current)
    clearTimeout(restoreTimeoutRef.current)
    feedReturnTargetsRef.current = []
    clearSelection()
  }, [enabled])

  useEffect(() => {
    return listenOpenKeyboardShortcuts(dialogControl.open)
  }, [dialogControl.open])

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.keyboardNavigationStyles = 'true'
    style.textContent = `
      [data-keyboard-navigation-selected="true"] {
        outline: 2px solid ${t.palette.primary_500} !important;
        outline-offset: -2px !important;
        scroll-margin-top: 64px;
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [t.palette.primary_500])

  useEffect(() => {
    const consume = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (!(target instanceof Element) || shouldIgnoreTarget(target)) {
        clearChord()
        return
      }

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

      if (!enabled) {
        if (APP_CHARACTER_KEYS.has(key)) event.stopPropagation()
        return
      }
      if (!globalScopeActive) {
        clearChord()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        clearChord()
        return
      }
      if (event.shiftKey && key !== '?') {
        clearChord()
        return
      }
      if (event.repeat && key !== 'j' && key !== 'k') return

      if (pendingChordRef.current === 'g') {
        clearChord()
        consume(event)
        goTo(key)
        return
      }

      if (key === 'g') {
        consume(event)
        pendingChordRef.current = 'g'
        chordTimeoutRef.current = setTimeout(clearChord, CHORD_TIMEOUT_MS)
        return
      }

      if (key === '?') {
        consume(event)
        dialogControl.open()
        return
      }

      if (key === '.') {
        consume(event)
        clearSelection()
        emitSoftReset()
        return
      }

      if (key === 'h') {
        const returnTarget = feedReturnTargetsRef.current.at(-1)
        if (returnTarget && getCurrentPath() === returnTarget.destinationPath) {
          consume(event)
          window.history.back()
        }
        return
      }

      if (key === 'Escape') {
        if (clearSelection()) consume(event)
        return
      }

      if (key === 'j' || key === 'k') {
        if (moveSelection(key === 'j' ? 1 : -1)) consume(event)
        return
      }

      if (key === 'b' || key === 'Enter') {
        const selected = getSelectedVisiblePost()
        if (
          selected &&
          !isInteractiveTarget(target, selected) &&
          openSelectedPost()
        ) {
          consume(event)
        }
        return
      }

      const postAction = POST_ACTIONS[key]
      if (postAction && runPostAction(postAction)) consume(event)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('popstate', restoreFeedSelection)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('popstate', restoreFeedSelection)
      clearChord()
      clearTimeout(openedPostTimeoutRef.current)
      clearTimeout(restoreTimeoutRef.current)
    }
  }, [currentAccount, dialogControl, enabled, globalScopeActive, hasSession])

  useEffect(() => {
    return () => {
      clearSelection(false)
    }
  }, [])

  return (
    <>
      <KeyboardShortcutsDialog
        control={dialogControl}
        onOpen={() => setDialogOpen(true)}
        onClose={() => setDialogOpen(false)}
      />
      <View
        accessibilityLiveRegion="polite"
        style={[
          a.absolute,
          {
            width: 1,
            height: 1,
            overflow: 'hidden',
            opacity: 0,
          },
        ]}>
        <Text>{announcement}</Text>
      </View>
    </>
  )
}

function shouldIgnoreTarget(target: Element) {
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="slider"], [role="spinbutton"], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"], [role="dialog"], [aria-modal="true"]',
    ),
  )
}

function isInteractiveTarget(target: Element, selected: HTMLElement) {
  const interactive = target.closest(
    'a, button, [role="button"], [role="link"], [role="menuitem"], [role="option"]',
  )
  return Boolean(interactive && interactive !== selected)
}
