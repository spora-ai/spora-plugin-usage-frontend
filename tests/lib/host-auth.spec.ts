import { describe, expect, it } from 'vitest'
import { createPinia, defineStore } from 'pinia'
import { ref } from 'vue'
import { hostAuthStore } from '../../src/lib/host-auth'

function piniaWithAuthStore(): ReturnType<typeof createPinia> {
    const pinia = createPinia()
    const useHostAuth = defineStore('auth', () => ({
        user: ref<{ is_admin: boolean } | null>({ is_admin: true }),
    }))
    useHostAuth(pinia)
    return pinia
}

describe('the host\'s auth store', () => {
    it('is the store the host registered under the id it uses', () => {
        const pinia = piniaWithAuthStore()
        const store = hostAuthStore(pinia)
        expect(store?.user?.is_admin).toBe(true)
    })

    it('is nothing when there is no Pinia instance at all', () => {
        expect(hostAuthStore(null)).toBeNull()
        expect(hostAuthStore(undefined)).toBeNull()
    })

    it('is nothing when what was handed over is not an object', () => {
        expect(hostAuthStore('pinia')).toBeNull()
    })

    it('is nothing when the instance carries no store map', () => {
        expect(hostAuthStore({})).toBeNull()
        expect(hostAuthStore({ _s: {} })).toBeNull()
    })

    it('is nothing when the store map holds no auth store', () => {
        expect(hostAuthStore({ _s: new Map() })).toBeNull()
    })

    it('is nothing when the auth store is not an object', () => {
        expect(hostAuthStore({ _s: new Map([['auth', 'nope']]) })).toBeNull()
    })
})
