import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DefaultsTab from '../src/components/DefaultsTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'
import type { UsageDefaultLimits } from '../src/types'

const defaultsResponse: { defaults: UsageDefaultLimits } = {
    defaults: {
        all: [
            {
                window: 'month',
                window_size: 1,
                unit: 'credits',
                cap: 1000,
                mode: 'hard',
                enabled: true,
            },
        ],
        user: [
            {
                window: 'day',
                window_size: 1,
                unit: 'credits',
                cap: 100,
                mode: 'soft',
                enabled: true,
            },
        ],
        group: [],
    },
}

function mountTab(options: HostOptions = {}) {
    const host = buildHost({
        isAdmin: true,
        ...options,
        get: {
            '/usage/defaults': () => defaultsResponse,
            ...options.get,
        },
        put: {
            '/usage/defaults': (body) => ({ defaults: (body as { defaults: UsageDefaultLimits }).defaults }),
            ...options.put,
        },
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(DefaultsTab, {
        props: { hostContext: host.context, idPrefix: 'usage' },
        global: { plugins: [pinia] },
    })
    return { wrapper, host, pinia }
}

describe('DefaultsTab', () => {
    it('holds a section for every scope, and says what each one covers', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-defaults-all"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-defaults-user"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-defaults-group"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Every principal that has no limits of their own.')
        expect(wrapper.text()).toContain('The principals of a user. Replaces the general default for users.')
        expect(wrapper.text()).toContain('The principals of a group. Replaces the general default for groups.')
    })

    it('says that a principal nobody configured is held to the defaults', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        expect(wrapper.text()).toContain(
            'A principal with no limits of its own is held to these defaults, so nobody is left unlimited.',
        )
    })

    it('reads the defaults', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        expect(host.api.get).toHaveBeenCalledWith('/usage/defaults')
        expect(wrapper.findAll('[data-testid^="usage-defaults-all-limit-editor-"]')).toHaveLength(1)
        expect(wrapper.findAll('[data-testid^="usage-defaults-user-limit-editor-"]')).toHaveLength(1)
        expect(wrapper.findAll('[data-testid^="usage-defaults-group-limit-editor-"]')).toHaveLength(0)
    })

    it('shows the rows of a scope in that scope\'s own table', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        const user = wrapper.find('[data-testid="usage-defaults-user"]')
        expect(
            user.find<HTMLInputElement>('[data-testid="usage-defaults-user-limit-cap-0"]').element
                .value,
        ).toBe('100')
        const all = wrapper.find('[data-testid="usage-defaults-all"]')
        expect(
            all.find<HTMLInputElement>('[data-testid="usage-defaults-all-limit-cap-0"]').element.value,
        ).toBe('1000')
    })

    it('says that a scope has no limits', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        const group = wrapper.find('[data-testid="usage-defaults-group"]')
        expect(group.text()).toContain('No default limits are set.')
    })

    it('shows no spend for a default, because it governs nobody in particular', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-defaults-all-limit-figures-0"]').exists()).toBe(false)
    })

    it('saves the three scopes in one request', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [path, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(path).toBe('/usage/defaults')
        expect(body.defaults.all).toHaveLength(1)
        expect(body.defaults.user).toHaveLength(1)
        expect(body.defaults.group).toHaveLength(0)
    })

    it('sends the rows without the figures the editor holds', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(body.defaults.all[0]).toEqual({
            window: 'month',
            window_size: 1,
            unit: 'credits',
            cap: 1000,
            mode: 'hard',
            enabled: true,
        })
    })

    it('sends an edited cap', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-all-limit-cap-0"]').setValue('250')
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(body.defaults.all[0]?.cap).toBe(250)
    })

    it('adds a row to one scope and leaves the others alone', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-user-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(body.defaults.user).toHaveLength(2)
        expect(body.defaults.user[1]?.cap).toBe(0)
        expect(body.defaults.all).toHaveLength(1)
        expect(body.defaults.group).toHaveLength(0)
    })

    it('drops a row the operator removed', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-all-limit-remove-0"]').trigger('click')
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(body.defaults.all).toHaveLength(0)
    })

    it('leaves the other rows of a scope alone when one of them is edited', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-all-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-defaults-all-limit-cap-0"]').setValue('250')
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { defaults: UsageDefaultLimits }]
        expect(body.defaults.all[0]?.cap).toBe(250)
        expect(body.defaults.all[1]?.cap).toBe(0)
    })

    it('keeps the sets the server stored, so the other tabs name them', async () => {
        const { wrapper, pinia } = mountTab()
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-all-limit-cap-0"]').setValue('250')
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        expect(useUsageStore(pinia).defaults.all[0]?.cap).toBe(250)
        expect(wrapper.find('[data-testid="usage-defaults-saved"]').exists()).toBe(true)
    })

    it('keeps the save button closed until the defaults are read', () => {
        const { wrapper } = mountTab()
        // A save before the read would store three empty sets over
        // whatever the server holds.
        expect(wrapper.find('[data-testid="usage-defaults-save"]').attributes('disabled')).toBeDefined()
    })

    it('does not ask again for defaults the store already holds', async () => {
        const host = buildHost({
            isAdmin: true,
            get: { '/usage/defaults': () => defaultsResponse },
        })
        const pinia = createPinia()
        setActivePinia(pinia)
        const store = useUsageStore(pinia)
        store.defaults = defaultsResponse.defaults
        store.defaultsLoaded = true
        mount(DefaultsTab, {
            props: { hostContext: host.context, idPrefix: 'usage' },
            global: { plugins: [pinia] },
        })
        await flushPromises()
        expect(host.api.get).not.toHaveBeenCalledWith('/usage/defaults')
    })

    it('shows that the defaults are being read', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/defaults': () => new Promise(() => {}) },
        })
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-defaults-loading"]').exists()).toBe(true)
    })

    it('surfaces a failed read of the defaults', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/defaults': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-defaults-error"]').text()).toContain('Boom')
    })

    it('surfaces a failed save without blanking the rows', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/defaults': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-defaults-save-error"]').text()).toContain('Boom')
        expect(wrapper.findAll('[data-testid^="usage-defaults-all-limit-editor-"]')).toHaveLength(1)
    })

    it('marks the caller as not an admin when the API refuses the defaults', async () => {
        const { wrapper, pinia } = mountTab({
            get: {
                '/usage/defaults': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-defaults-error"]').exists()).toBe(false)
    })

    it('marks the caller as not an admin when the API refuses the save', async () => {
        const { wrapper, pinia } = mountTab({
            put: {
                '/usage/defaults': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-defaults-save"]').trigger('click')
        await flushPromises()
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-defaults-save-error"]').exists()).toBe(false)
    })
})
