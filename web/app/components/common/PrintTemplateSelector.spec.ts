/**
 * 打印模板选择器单元测试（P2）
 *
 * 覆盖：
 * - 打开默认选中 A5；点击切换；确认发 confirm+关闭；
 * - 取消按钮 / 右上角关闭（X）：仅发 cancel 一次并关闭，不发 confirm；
 * - 确认关闭绝不额外触发 cancel（回归：此前 @close 导致确认时多触发一次取消）；
 * - 详情页链路：取消/关闭不打印、不更新已打印状态；确认才打印并更新状态。
 */
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import PrintTemplateSelector from './PrintTemplateSelector.vue'

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/**
 * el-dialog 最小 stub：
 * 复刻真实组件的受控契约——右上角关闭按钮内部触发 update:modelValue(false)。
 */
const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: String,
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    return () => {
      if (!props.modelValue) return null
      return h('div', { class: 'el-dialog-stub' }, [
        h('button', { class: 'stub-close', onClick: () => emit('update:modelValue', false) }, '关闭'),
        h('div', { class: 'stub-body' }, slots.default?.()),
        h('div', { class: 'stub-footer' }, slots.footer?.()),
      ])
    }
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { emit, slots }) {
    return () => h('button', { class: 'stub-button', onClick: (e: MouseEvent) => emit('click', e) }, slots.default?.())
  },
})

const ElIconStub = defineComponent({
  name: 'ElIcon',
  setup(_, { slots }) {
    return () => h('span', { class: 'stub-icon' }, slots.default?.())
  },
})

const stubs = { ElDialog: ElDialogStub, ElButton: ElButtonStub, ElIcon: ElIconStub }

function mountSelector(modelValue = false) {
  return mount(PrintTemplateSelector, {
    props: { modelValue },
    global: { stubs },
  })
}

function buttonByText(wrapper: VueWrapper<any>, text: string) {
  const btn = wrapper.findAll('.stub-button').find(b => b.text() === text)
  if (!btn) throw new Error(`未找到按钮：${text}`)
  return btn
}

describe('PrintTemplateSelector', () => {
  it('打开时默认选中 A5，两个选项存在', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    const options = wrapper.findAll('.template-option')
    expect(options).toHaveLength(2)
    expect(options[0]!.classes()).toContain('is-selected')
    expect(options[1]!.classes()).not.toContain('is-selected')
    expect(options[0]!.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('A5（自动压缩）')
    expect(wrapper.text()).toContain('A4 纸上输出横向 A5 版式，打印后可裁切；批量每页两份')
    expect(wrapper.text()).toContain('A4（自动分页）')
    expect(wrapper.text()).toContain('A4 纵向正常字号，内容自然分页，每份独立开始')

    wrapper.unmount()
  })

  it('默认确认：emit confirm a5 + 关闭，且不发 cancel', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await buttonByText(wrapper, '确认打印').trigger('click')

    const emitted = wrapper.emitted()
    expect(emitted.confirm).toHaveLength(1)
    expect(emitted.confirm![0]).toEqual(['a5'])
    expect(emitted['update:modelValue']?.at(-1)).toEqual([false])
    expect(emitted.cancel).toBeUndefined()

    wrapper.unmount()
  })

  it('点击 A4 选项后确认：emit confirm a4 + 关闭，且不发 cancel', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await wrapper.findAll('.template-option')[1]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.template-option')[1]!.classes()).toContain('is-selected')

    await buttonByText(wrapper, '确认打印').trigger('click')

    const emitted = wrapper.emitted()
    expect(emitted.confirm![0]).toEqual(['a4'])
    expect(emitted['update:modelValue']?.at(-1)).toEqual([false])
    expect(emitted.cancel).toBeUndefined()

    wrapper.unmount()
  })

  it('取消按钮：emit cancel 一次并关闭，不发 confirm', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await buttonByText(wrapper, '取消').trigger('click')

    const emitted = wrapper.emitted()
    expect(emitted.cancel).toHaveLength(1)
    expect(emitted['update:modelValue']?.at(-1)).toEqual([false])
    expect(emitted.confirm).toBeUndefined()

    wrapper.unmount()
  })

  it('右上角关闭：emit cancel 一次并关闭，不发 confirm', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await wrapper.find('.stub-close').trigger('click')

    const emitted = wrapper.emitted()
    expect(emitted.cancel).toHaveLength(1)
    expect(emitted['update:modelValue']?.at(-1)).toEqual([false])
    expect(emitted.confirm).toBeUndefined()

    wrapper.unmount()
  })

  it('确认关闭不额外触发取消（cancel 事件不重复、不误发）', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await buttonByText(wrapper, '确认打印').trigger('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted()
    expect(emitted.confirm).toHaveLength(1)
    expect(emitted.cancel).toBeUndefined()

    wrapper.unmount()
  })

  it('关闭后重新打开，重置为默认 A5', async () => {
    const wrapper = mountSelector(true)
    await wrapper.vm.$nextTick()

    await wrapper.findAll('.template-option')[1]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.template-option')[1]!.classes()).toContain('is-selected')

    await wrapper.setProps({ modelValue: false })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ modelValue: true })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.template-option')[0]!.classes()).toContain('is-selected')

    wrapper.unmount()
  })
})

describe('详情页打印链路（取消不打印、不更新状态）', () => {
  it('取消/右上角关闭：不调用打印、不更新已打印状态；确认才打印并更新', async () => {
    const printFn = vi.fn()
    const updateStatusFn = vi.fn()
    const visible = ref(true)

    const Harness = defineComponent({
      components: { PrintTemplateSelector },
      setup() {
        // 复刻 pages/accruals/[id].vue 的接线：
        // 打印失败则不更新状态；取消只关闭弹窗
        function handleConfirm(template: 'a5' | 'a4') {
          try {
            printFn(template)
          } catch {
            return
          }
          updateStatusFn()
        }
        function handleCancel() {
          visible.value = false
        }
        return () => h('div', [
          h(PrintTemplateSelector, {
            modelValue: visible.value,
            'onUpdate:modelValue': (v: boolean) => { visible.value = v },
            onConfirm: handleConfirm,
            onCancel: handleCancel,
          }),
        ])
      },
    })

    const wrapper = mount(Harness, { global: { stubs } })
    await wrapper.vm.$nextTick()

    // 右上角关闭 → 视为取消：不打印、不更新状态
    await wrapper.find('.stub-close').trigger('click')
    expect(printFn).not.toHaveBeenCalled()
    expect(updateStatusFn).not.toHaveBeenCalled()

    // 再次打开 → 确认 A5 → 打印 + 更新状态
    visible.value = true
    await wrapper.vm.$nextTick()
    await buttonByText(wrapper, '确认打印').trigger('click')
    expect(printFn).toHaveBeenCalledTimes(1)
    expect(printFn).toHaveBeenCalledWith('a5')
    expect(updateStatusFn).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})

describe('确认事件顺序', () => {
  it('父组件记录事件：先关闭 v-model 后 emit confirm，且不产生 cancel', async () => {
    const events: string[] = []
    const visible = ref(true)

    const Harness = defineComponent({
      components: { PrintTemplateSelector },
      setup() {
        return () => h('div', [
          h(PrintTemplateSelector, {
            modelValue: visible.value,
            'onUpdate:modelValue': (v: boolean) => { events.push('update:modelValue'); visible.value = v },
            onConfirm: () => events.push('confirm'),
            onCancel: () => events.push('cancel'),
          }),
        ])
      },
    })

    const wrapper = mount(Harness, { global: { stubs } })
    await wrapper.vm.$nextTick()

    // 同一次「确认打印」点击调用链：严格顺序 update:modelValue(false) → confirm
    await buttonByText(wrapper, '确认打印').trigger('click')

    expect(events).toEqual(['update:modelValue', 'confirm'])
    expect(events).not.toContain('cancel')

    wrapper.unmount()
  })
})
