const POST_SELECTOR = '[data-keyboard-navigation-post]'
const SELECTED_ATTRIBUTE = 'data-keyboard-navigation-selected'

export type PostAction =
  'reply' | 'like' | 'repost' | 'save' | 'share' | 'media'

const ACTION_TEST_IDS: Record<PostAction, string> = {
  reply: 'replyBtn',
  like: 'likeBtn',
  repost: 'repostBtn',
  save: 'postBookmarkBtn',
  share: 'postShareBtn',
  media: 'postMediaOpenBtn',
}

function isRendered(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function isPostVisible(element: HTMLElement) {
  if (!element.isConnected || !isRendered(element)) return false

  const rect = element.getBoundingClientRect()
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  )
}

export function getNavigablePosts() {
  return Array.from(document.querySelectorAll<HTMLElement>(POST_SELECTOR))
    .filter(isRendered)
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.right > 0 && rect.left < window.innerWidth
    })
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return aRect.top - bRect.top || aRect.left - bRect.left
    })
}

export function getInitialVisiblePost(posts: HTMLElement[]) {
  return posts.find(isPostVisible)
}

export function setPostSelected(element: HTMLElement, selected: boolean) {
  if (selected) {
    element.setAttribute(SELECTED_ATTRIBUTE, 'true')
  } else {
    element.removeAttribute(SELECTED_ATTRIBUTE)
  }
}

export function clickPostAction(element: HTMLElement, action: PostAction) {
  const control = element.querySelector<HTMLElement>(
    `[data-testid="${ACTION_TEST_IDS[action]}"]`,
  )
  if (!control) return false

  control.click()
  if (action === 'repost') {
    setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-testid="repostDropdownRepostBtn"]')
        ?.click()
    })
  }
  return true
}

export function clickPost(element: HTMLElement) {
  if (element.dataset.keyboardNavigationClickable === 'true') {
    element.click()
    return true
  }
  return false
}

export function getPostHref(element: HTMLElement) {
  return element.dataset.keyboardNavigationHref
}

export function getPostAnnouncement(element: HTMLElement) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)
}
