import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LimitsTab from '../src/components/LimitsTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

const detailResponse = {
    principal: { id: 12, type: 'user', name: 'Ada Lovelace' },
    balance: 250.5,
    limits: [
        {
            window: 'month',
            window_size: 1,
            unit: 'credits',
            cap: 10000,
            mode: 'hard',
            enabled: true,
            spend: 1234.5,
            remaining: 8765.5,
        },
    ],
    spend: { credits_30d: 1234.5, total_tokens_30d: 340000 },
}

function mountTab(options: HostOptions = {}, selectedPrincipalId: number | null = 12) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/principals/12': () => detailResponse,
            ...options.get,
        },
        put: {
            '/usage/principals/12/limits': () => ({ limits: detailResponse.limits }),
            ...options.put,
        },
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    if (selectedPrincipalId !== null) {
        useUsageStore().selectedPrincipalId = selectedPrincipalId
    }
    const wrapper = mount(LimitsTab, {
        props: { hostContext: host.context },
        global: { plugins: [pinia] },
    })
    return { wrapper, host }
}

describe('LimitsTab', () => {
    it('asks for a principal before it shows a limit', async () => {
        const { wrapper, host } = mountTab({}, null)
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limits-no-principal"]').exists()).toBe(true)
        expect(host.api.get).not.toHaveBeenCalled()
    })

    it('loads the limits of the selected principal', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(host.api.get).toHaveBeenCalledWith('/usage/principals/12')
        expect(wrapper.find('[data-testid="usage-limits-principal"]').text()).toContain(
            'Ada Lovelace',
        )
        expect(wrapper.find('[data-testid="usage-limits-credits-30d"]').text()).toContain('1,234.5')
        expect(wrapper.findAll('[data-testid^="usage-limit-editor-"]')).toHaveLength(1)
    })

    it('saves the whole set of limits without the figures the server computed', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [path, body] = host.api.put.mock.calls[0] as [string, { limits: unknown[] }]
        expect(path).toBe('/usage/principals/12/limits')
        expect(body.limits).toEqual([
            {
                window: 'month',
                window_size: 1,
                unit: 'credits',
                cap: 10000,
                mode: 'hard',
                enabled: true,
            },
        ])
    })

    it('sends an edited cap', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('500')
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { limits: { cap: number }[] }]
        expect(body.limits[0]?.cap).toBe(500)
    })

    it('sends a number for a cap the operator cleared', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('')
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { limits: { cap: number }[] }]
        expect(body.limits[0]?.cap).toBe(0)
    })

    it('asks the server for the figures again after a save', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        host.api.get.mockClear()
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        expect(host.api.get).toHaveBeenCalledWith('/usage/principals/12')
    })

    it('shows no figures for a limit the server has not seen', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limit-figures-0"]').text()).toContain('1,234.5')
        await wrapper.find('[data-testid="usage-limits-add"]').trigger('click')
        expect(wrapper.find('[data-testid="usage-limit-figures-1"]').text()).toContain('—')
    })

    it('drops a limit the operator removed', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limit-remove-0"]').trigger('click')
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { limits: unknown[] }]
        expect(body.limits).toEqual([])
    })

    it('adds a limit the operator asked for', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limits-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { limits: { cap: number }[] }]
        expect(body.limits).toHaveLength(2)
        expect(body.limits[1]?.cap).toBe(0)
    })

    it('offers the window size only for a rolling limit', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limit-window-size-0"]').exists()).toBe(false)
        await wrapper.find('[data-testid="usage-limit-window-0"]').setValue('rolling')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limit-window-size-0"]').exists()).toBe(true)
    })

    it('surfaces a failed save without blanking the rows', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/principals/12/limits': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limits-save-error"]').text()).toContain('Boom')
        expect(wrapper.findAll('[data-testid^="usage-limit-editor-"]')).toHaveLength(1)
    })

    it('surfaces a failed load of the limits', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals/12': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limits-error"]').text()).toContain('Boom')
        expect(wrapper.findAll('[data-testid^="usage-limit-editor-"]')).toHaveLength(0)
    })

    it('marks the caller as not an admin when the API refuses the limits', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals/12': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(useUsageStore().adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-limits-error"]').exists()).toBe(false)
    })

    it('marks the caller as not an admin when the API refuses the save', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/principals/12/limits': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        expect(useUsageStore().adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-limits-save-error"]').exists()).toBe(false)
    })

    it('sends nothing when the principal is gone by the time the save runs', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        // The panel still holds the button, but there is no principal left
        // to save the limits of.
        useUsageStore().selectedPrincipalId = null
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        expect(host.api.put).not.toHaveBeenCalled()
    })

    it('leaves the other rows alone when one of them is edited', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-limits-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('500')
        await wrapper.find('[data-testid="usage-limits-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { limits: { cap: number }[] }]
        expect(body.limits[0]?.cap).toBe(500)
        expect(body.limits[1]?.cap).toBe(0)
    })

    it('shows no limits when the server sent none', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals/12': () => ({ ...detailResponse, limits: undefined }),
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-limits-error"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('No limits are set.')
        expect(wrapper.findAll('[data-testid^="usage-limit-editor-"]')).toHaveLength(0)
    })
})
