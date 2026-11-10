import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUsageStore } from '../../src/stores/usage'
import type { PluginHostContext } from '../../src/shims'
import type { UsageDefaultLimits } from '../../src/types'

const sets: UsageDefaultLimits = {
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
    user: [],
    group: [],
}

/**
 * A host client that answers one path.
 */
function fakeApi(answer: (path: string) => unknown): PluginHostContext['api'] {
    return {
        get: vi.fn(async (path: string) => answer(path)),
    } as unknown as PluginHostContext['api']
}

describe('the usage store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('reads the default limits and keeps them', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => ({ defaults: sets }))

        await store.loadDefaults(api)

        expect(store.defaults).toEqual(sets)
        expect(store.defaultsLoaded).toBe(true)
        expect(store.defaultsError).toBeNull()
    })

    it('asks for the default limits once', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => ({ defaults: sets }))

        await store.loadDefaults(api)
        await store.loadDefaults(api)

        expect(api.get).toHaveBeenCalledTimes(1)
    })

    it('does not ask again while a read is running', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => new Promise(() => {}))

        void store.loadDefaults(api)
        await store.loadDefaults(api)

        expect(api.get).toHaveBeenCalledTimes(1)
        expect(store.defaultsLoading).toBe(true)
    })

    it('keeps the message of a failed read', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => {
            throw new Error('Boom')
        })

        await store.loadDefaults(api)

        expect(store.defaultsError).toBe('Boom')
        expect(store.defaultsLoaded).toBe(false)
        expect(store.defaultsLoading).toBe(false)
    })

    it('marks the caller as not an admin when the API refuses the defaults', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => {
            throw Object.assign(new Error('Forbidden'), { status: 403 })
        })

        await store.loadDefaults(api)

        expect(store.adminDenied).toBe(true)
        expect(store.defaultsError).toBeNull()
    })

    it('writes the stored sets back', () => {
        const store = useUsageStore()

        store.setDefaults(sets)

        expect(store.defaults).toEqual(sets)
        expect(store.defaultsLoaded).toBe(true)
    })

    it('reads a scope the server left out as an empty set', async () => {
        const store = useUsageStore()
        const api = fakeApi(() => ({ defaults: { all: sets.all } }))

        await store.loadDefaults(api)

        expect(store.defaults).toEqual({ all: sets.all, user: [], group: [] })
    })
})
