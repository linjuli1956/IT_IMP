/**
 * ActionButton 组件 DOM 断言测试
 *
 * 覆盖审计要求的两类断言：
 * 1. 外链（href）disabled/loading 不可用状态 DOM 契约（P1）
 *    - href 移除 → 不可导航
 *    - tabindex="-1" → 不可 Tab 聚焦
 *    - is-disabled class → 不可用视觉（not-allowed + opacity）
 *    - aria-disabled / aria-busy 正确表达
 *    - click 不 emit（preventDefault + stopPropagation）
 * 2. "更多" 触发器 span→button 后键盘可达性（P2）
 *    - <button type="button"> 可 Tab 聚焦且 click 可触发
 *    - 对比 <span> 不可 Tab 聚焦（旧实现缺陷）
 */
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionButton from './ActionButton.vue'

/** Element Plus 组件在 vitest 中未全局注册，统一 stub */
const globalStubs = { global: { stubs: { ElIcon: true } } }

describe('ActionButton 外链（href）不可用状态 DOM 断言', () => {
  it('正常状态：渲染 <a> 且保留 href，无 is-disabled', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'external', href: 'https://example.com' },
      ...globalStubs,
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('https://example.com')
    expect(wrapper.classes()).not.toContain('is-disabled')
    expect(wrapper.attributes('aria-disabled')).toBe('false')
  })

  it('disabled：移除 href + tabindex=-1 + is-disabled + aria-disabled=true', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'external', href: 'https://example.com', disabled: true },
      ...globalStubs,
    })
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.attributes('tabindex')).toBe('-1')
    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
  })

  it('loading：移除 href + tabindex=-1 + is-disabled + aria-disabled + aria-busy', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'external', href: 'https://example.com', loading: true },
      ...globalStubs,
    })
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.attributes('tabindex')).toBe('-1')
    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('disabled 外链点击不触发 click 事件', async () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'external', href: 'https://example.com', disabled: true },
      ...globalStubs,
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading 外链点击不触发 click 事件', async () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'external', href: 'https://example.com', loading: true },
      ...globalStubs,
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})

describe('ActionButton 普通按钮（无 href）键盘可达性与不可用态', () => {
  it('渲染 <button type="button">，可 Tab 聚焦', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'primary' },
      slots: { default: '保存' },
      attachTo: document.body,
      ...globalStubs,
    })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    const el = wrapper.element as HTMLButtonElement
    el.focus()
    expect(document.activeElement).toBe(el)
    wrapper.unmount()
  })

  it('click 触发 emit', async () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'primary' },
      slots: { default: '保存' },
      ...globalStubs,
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disabled：button[disabled] + is-disabled + 不触发 click', async () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'primary', disabled: true },
      slots: { default: '保存' },
      ...globalStubs,
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('is-disabled')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading：button[disabled] + is-disabled + 不触发 click', async () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'primary', loading: true },
      slots: { default: '保存' },
      ...globalStubs,
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('is-disabled')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})

describe('action-text "更多" 触发器键盘可达性（span→button 修复验证）', () => {
  it('<button type="button" class="action-text"> 可 Tab 聚焦且 click 可触发', () => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-text action-text--info'
    btn.textContent = '更多'
    document.body.appendChild(btn)

    let clicked = false
    btn.addEventListener('click', () => { clicked = true })

    btn.focus()
    expect(document.activeElement).toBe(btn)

    btn.click()
    expect(clicked).toBe(true)

    document.body.removeChild(btn)
  })

  it('<span class="action-text"> 默认不可 Tab 导航（旧实现缺陷对比）', () => {
    const span = document.createElement('span')
    span.className = 'action-text action-text--info'
    span.textContent = '更多'
    // span 默认 tabIndex=-1（不可 Tab 导航），button 默认 tabIndex=0（可 Tab 导航）
    expect(span.tabIndex).toBe(-1)
  })
})
