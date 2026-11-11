import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UsageLimitTable from '../src/components/UsageLimitTable.vue'
import type { UsageLimit } from '../src/types'

const limit: UsageLimit = {
    window: 'month',
    window_size: 1,
    unit: 'credits',
    cap: 10000,
    mode: 'hard',
    enabled: true,
    spend: 1234.5,
    remaining: 8765.5,
}

function mountTable(limits: UsageLimit[] = [limit]) {
    return mount(UsageLimitTable, { props: { limits, locale: 'en' } })
}

describe('UsageLimitTable', () => {
    it('shows the window, the unit and the figures of a limit', () => {
        const wrapper = mountTable()
        const row = wrapper.find('[data-testid="usage-limit-row-0"]')
        expect(row.text()).toContain('Month')
        expect(row.text()).toContain('Credits')
        expect(row.text()).toContain('10,000')
        expect(row.text()).toContain('1,234.5')
        expect(row.text()).toContain('8,765.5')
    })

    it('shows the hours of a rolling limit', () => {
        const wrapper = mountTable([{ ...limit, window: 'rolling', window_size: 24 }])
        expect(wrapper.find('[data-testid="usage-limit-row-0"]').text()).toContain('24 h')
    })

    it('says that a limit is off', () => {
        const wrapper = mountTable([{ ...limit, enabled: false }])
        expect(wrapper.find('[data-testid="usage-limit-row-0"]').text()).toContain('Off')
    })

    it('dims a limit that is off', () => {
        const wrapper = mountTable([{ ...limit, enabled: false }])
        expect(wrapper.find('[data-testid="usage-limit-row-0"]').classes()).toContain('opacity-60')
    })

    it('fills the bar of a limit by how much of the cap it has spent', () => {
        const wrapper = mountTable()
        const bar = wrapper.findAll('td')[4]?.findAll('span')[1]?.find('span')
        expect(bar?.attributes('style')).toContain('width: 12%')
    })

    it('shows a limit that overshot its cap as overshot', () => {
        const wrapper = mountTable([
            { ...limit, spend: 12000, remaining: -2000 },
        ])
        const left = wrapper.findAll('td')[4]
        expect(left?.findAll('span')[0]?.classes()).toContain('text-destructive')
        expect(left?.findAll('span')[1]?.find('span')?.classes()).toContain('bg-destructive')
        expect(left?.findAll('span')[1]?.find('span')?.attributes('style')).toContain('width: 100%')
    })

    it('says so when no limit is set', () => {
        const wrapper = mountTable([])
        expect(wrapper.text()).toContain('No limits are set.')
    })
})
