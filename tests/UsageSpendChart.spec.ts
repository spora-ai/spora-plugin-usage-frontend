import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UsageSpendChart from '../src/components/UsageSpendChart.vue'
import type { UsageSeriesPoint } from '../src/types'

function point(credits: number, at: string): UsageSeriesPoint {
    return {
        at,
        credits,
        total_tokens: 100,
        output_tokens: 40,
        llm_calls: 2,
        tool_calls: 1,
    }
}

function mountChart(points: UsageSeriesPoint[]) {
    return mount(UsageSpendChart, { props: { points, locale: 'en' } })
}

function barHeight(wrapper: ReturnType<typeof mountChart>, index: number): string {
    return (
        wrapper.find(`[data-testid="usage-spend-bar-${index}"]`).find('div').attributes('style') ?? ''
    )
}

describe('UsageSpendChart', () => {
    it('scales every bar against the tallest one', () => {
        const wrapper = mountChart([point(4, '2026-11-09T10:00:00+00:00'), point(2, '2026-11-09T11:00:00+00:00')])
        expect(barHeight(wrapper, 0)).toContain('height: 100%')
        expect(barHeight(wrapper, 1)).toContain('height: 50%')
    })

    it('draws no height for a window without any spend', () => {
        const wrapper = mountChart([point(0, '2026-11-09T10:00:00+00:00')])
        expect(barHeight(wrapper, 0)).toContain('height: 0%')
    })

    it('totals the window', () => {
        const wrapper = mountChart([point(1.25, '2026-11-09T10:00:00+00:00')])
        expect(wrapper.find('[data-testid="usage-spend-total-credits"]').text()).toBe('1.25')
        expect(wrapper.find('[data-testid="usage-spend-total-tokens"]').text()).toBe('100')
        expect(wrapper.find('[data-testid="usage-spend-total-output-tokens"]').text()).toBe('40')
        expect(wrapper.find('[data-testid="usage-spend-total-llm-calls"]').text()).toBe('2')
        expect(wrapper.find('[data-testid="usage-spend-total-tool-calls"]').text()).toBe('1')
    })

    it('says so when nothing was spent', () => {
        const wrapper = mountChart([])
        expect(wrapper.find('[data-testid="usage-spend-empty"]').exists()).toBe(true)
    })
})
