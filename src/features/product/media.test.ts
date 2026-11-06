import {getProduct} from '#/config/product'
import {postMediaMaxHeight} from './media'

it.each([300, 500, 800, 1200])(
  'caps inline news media at 80%% of a %spx viewport',
  height => {
    expect(postMediaMaxHeight(height, getProduct('news'))).toBe(height * 0.8)
    expect(postMediaMaxHeight(height, getProduct('social'))).toBeUndefined()
  },
)
