import { createPinia, defineStore } from 'pinia'
import { ref } from 'vue'
import { vi } from 'vitest'
import type { PluginHostContext } from '../../src/shims'

export type GetHandler = (path: string) => unknown
export type PutHandler = (body: unknown) => unknown

export interface MockedApi {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    postForm: ReturnType<typeof vi.fn>
    patch: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
}

export interface HostOptions {
    /** The admin flag the host's auth store reports. */
    isAdmin?: boolean
    /** Answers for `get`, keyed by the exact path. */
    get?: Record<string, GetHandler>
    /** Answers for `put`, keyed by the exact path. */
    put?: Record<string, PutHandler>
}

export interface TestHost {
    context: PluginHostContext
    api: MockedApi
}

/**
 * A stand-in for the host.
 *
 * The panel reads the admin flag from the host's Pinia, so the stub
 * registers a store under the same id the host uses. A path without a
 * handler answers 404, the way a route the installation does not carry
 * would.
 */
export function buildHost(options: HostOptions = {}): TestHost {
    const get = vi.fn(async (path: string) => {
        const handler = options.get?.[path]
        if (handler === undefined) {
            throw Object.assign(new Error(`No handler for ${path}`), { status: 404 })
        }
        return handler(path)
    })
    const put = vi.fn(async (path: string, body: unknown) => {
        const handler = options.put?.[path]
        if (handler === undefined) {
            throw Object.assign(new Error(`No handler for ${path}`), { status: 404 })
        }
        return handler(body)
    })
    const api: MockedApi = {
        get,
        post: vi.fn(),
        postForm: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put,
    }

    const pinia = createPinia()
    const useHostAuth = defineStore('auth', () => ({
        user: ref<{ is_admin: boolean } | null>({ is_admin: options.isAdmin ?? false }),
    }))
    useHostAuth(pinia)

    return {
        context: {
            api: api as unknown as PluginHostContext['api'],
            pinia,
            theme: 'light',
            locale: 'en',
            route: { path: '/apps/usage', params: {}, query: {} },
            router: null,
        },
        api,
    }
}

/** An error shaped like the host's `ApiError`, for the 403 path. */
export function forbidden(message = 'Forbidden'): Error {
    return Object.assign(new Error(message), { status: 403 })
}
