/** @jest-environment jsdom */

import {
  clickPostAction,
  getInitialVisiblePost,
  getNavigablePosts,
  setPostSelected,
} from './postNavigation.web'

function createPost({
  top,
  left = 0,
}: {
  top: number
  left?: number
}): HTMLElement {
  const element = document.createElement('div')
  element.dataset.keyboardNavigationPost = `post-${top}`
  element.getBoundingClientRect = () => ({
    top,
    bottom: top + 100,
    left,
    right: left + 500,
    width: 500,
    height: 100,
    x: left,
    y: top,
    toJSON() {},
  })
  document.body.appendChild(element)
  return element
}

describe('post keyboard navigation', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('returns rendered posts in visual order', () => {
    const second = createPost({top: 200})
    const first = createPost({top: 20})
    createPost({top: 0, left: window.innerWidth + 100})

    expect(getNavigablePosts()).toEqual([first, second])
  })

  it('finds the first post visible in the viewport', () => {
    createPost({top: -200})
    const firstVisible = createPost({top: -50})
    createPost({top: 100})

    expect(getInitialVisiblePost(getNavigablePosts())).toBe(firstVisible)
  })

  it('marks selection and invokes a post control', () => {
    const post = createPost({top: 20})
    const like = document.createElement('button')
    const onLike = jest.fn()
    like.dataset.testid = 'likeBtn'
    like.addEventListener('click', onLike)
    post.appendChild(like)

    setPostSelected(post, true)
    expect(post.dataset.keyboardNavigationSelected).toBe('true')
    expect(clickPostAction(post, 'like')).toBe(true)
    expect(onLike).toHaveBeenCalledTimes(1)

    setPostSelected(post, false)
    expect(post.dataset.keyboardNavigationSelected).toBeUndefined()
  })
})
