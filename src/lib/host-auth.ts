/**
 * The host's auth store, reached through the host's Pinia.
 *
 * The plugin cannot import the host's `useAuthStore` — the host and the
 * plugin ship separate bundles — so the store is read from the instance the
 * host hands over in `hostContext.pinia`. Pinia keeps its stores in a map
 * keyed by the id they were defined with, and the host's auth store is
 * registered under `auth`.
 *
 * **The map is private.** `pinia._s` is not part of Pinia's API; it is an
 * internal field, and a future Pinia may rename it. There is no way around
 * it from here: the host publishes no module a plugin can import, and the
 * plugin's own bundle cannot reach the host's `useAuthStore`. The sibling
 * `spora-plugin-social-frontend` reads the host's theme store the same way,
 * so this is the family's established pattern. What would replace it is a
 * host change that publishes the user on the plugin host context.
 *
 * The plugin installs its *own* Pinia for its own state, so the host's
 * instance has to be named explicitly: a bare `useStore()` would resolve
 * against the plugin's.
 *
 * The host creates its auth store while it boots — before it mounts the
 * router, and so before any plugin can ask — so the store is registered by
 * the time a plugin mounts. Should it not be there, `hostAuthStore` answers
 * null and the panel reads the caller as a non-admin: the admin tabs
 * simply do not appear.
 */
export interface HostAuthUser {
    is_admin?: boolean
}

export interface HostAuthStore {
    user: HostAuthUser | null
}

export function hostAuthStore(pinia: unknown): HostAuthStore | null {
    if (pinia === null || typeof pinia !== 'object') {
        return null
    }
    const stores = (pinia as { _s?: unknown })._s
    if (!(stores instanceof Map)) {
        return null
    }
    const store = stores.get('auth') as HostAuthStore | undefined
    if (store === undefined || typeof store !== 'object') {
        return null
    }
    return store
}
