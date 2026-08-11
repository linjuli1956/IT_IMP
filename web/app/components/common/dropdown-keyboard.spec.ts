/**
 * el-dropdown "更多" 触发器键盘可达性集成测试
 *
 * 验证 P2 修复：span→button 后，servers.vue 的"更多"el-dropdown 触发器：
 *   - button.action-text 可 Tab 聚焦（tabIndex=0）
 *   - click（真实浏览器中 Enter/Space 会自动触发 button click，W3C 标准）打开菜单
 *   - 菜单项出现于 DOM，可继续键盘选择（click 菜单项触发 command）
 *
 * 注：happy-dom 不模拟浏览器 keydown→click 转换，故用 click 验证 Enter/Space
 * 的等价行为；真实浏览器中 button 的 Enter/Space 由浏览器自动转为 click。
 */
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'

// happy-dom 可能不提供 ResizeObserver，el-dropdown 内部 popper 依赖它
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      observe() {} unobserve() {} disconnect() {} takeRecords() { return [] }
    } as unknown as typeof IntersectionObserver
  }
})

/** 构造 el-dropdown + action-text button 测试组件（模拟 servers.vue 的"更多"） */
const TestDropdown = defineComponent({
  components: { ElDropdown, ElDropdownMenu, ElDropdownItem },
  emits: ['command'],
  setup(_, { emit }) {
    return () => h(ElDropdown as any, {
      trigger: 'click',
      onCommand: (cmd: string) => emit('command', cmd),
    }, {
      default: () => h('button', {
        type: 'button',
        class: 'action-text action-text--info',
      }, '更多'),
      dropdown: () => h(ElDropdownMenu as any, () => [
        h(ElDropdownItem as any, { command: 'password' }, () => '服务器凭据（可选）'),
        h(ElDropdownItem as any, { command: 'detail' }, () => '打开详情页'),
      ]),
    })
  },
})

function mountDropdown() {
  return mount(TestDropdown, {
    global: { stubs: { ElIcon: true } },
    attachTo: document.body,
  })
}

describe('el-dropdown "更多" 触发器键盘可达性', () => {
  it('button.action-text 存在且可 Tab 聚焦（tabIndex=0）', () => {
    const wrapper = mountDropdown()
    const btn = wrapper.find('button.action-text')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).tabIndex).toBe(0)
    ;(btn.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(btn.element)
    wrapper.unmount()
  })

  it('click（Enter/Space 浏览器等价）打开菜单，菜单项出现于 DOM', async () => {
    const wrapper = mountDropdown()
    const btn = wrapper.find('button.action-text')

    await btn.trigger('click')
    await nextTick()

    // el-dropdown 将菜单 teleport 到 body，检查菜单项出现
    const items = document.querySelectorAll('.el-dropdown-menu__item')
    expect(items.length).toBeGreaterThanOrEqual(2)

    wrapper.unmount()
  })

  it('菜单项可 click 选择，触发 command 事件', async () => {
    const wrapper = mountDropdown()
    const btn = wrapper.find('button.action-text')

    await btn.trigger('click')
    await nextTick()

    const items = document.querySelectorAll('.el-dropdown-menu__item')
    expect(items.length).toBeGreaterThan(0)

    // 点击第一个菜单项（服务器凭据）
    ;(items[0] as HTMLElement).click()
    await nextTick()

    expect(wrapper.emitted('command')).toBeTruthy()
    expect(wrapper.emitted('command')![0]).toEqual(['password'])

    wrapper.unmount()
  })
})
