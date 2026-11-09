/**
 * Dev-only entry. Boots the same component tree as the production bundle
 * but renders it into `#app` instead of the host's plugin slot, with a
 * mock host context that lets the UI load data without a backend.
 *
 * The mock API + fixtures live in `./dev-mock` so they can be unit-tested
 * without triggering this bootstrap. The production bundle (./main.ts) is
 * unaffected.
 *
 * For end-to-end testing against a real backend, run the host dev flow:
 *   1. PHP at :8080 (`composer dev` in spora-local)
 *   2. Plugin dev at :5196 (`npm run dev` here)
 *   3. Host SPA at :5173 (`npm run dev` in spora-frontend)
 * The host's `vite.config.ts → SPORA_PLUGIN_DEV_PORTS` then forwards
 * `/api` to PHP and `/plugins/usage/*` to this dev server.
 */
import { createApp, ref } from 'vue'
import { createPinia, defineStore } from 'pinia'
import App from './App.vue'
import type { PluginHostContext } from './shims'
import { createMockApi } from './dev-mock'
import { createPluginI18n } from './i18n'

// One-line banner so the developer knows they're in sandbox mode and
// doesn't waste time wondering why their real backend isn't responding.
console.info('[spora/usage] dev sandbox — using in-memory fixtures (no backend)')

const params = new URLSearchParams(location.search)

// `?locale=de` renders the panel in German without touching the code.
const locale = params.get('locale') ?? 'en'

/**
 * The sandbox's stand-in for the host's auth store.
 *
 * The panel reads the admin flag from the host's Pinia, so the sandbox
 * registers a store under the same id — otherwise the admin tabs would
 * never appear here. `?admin=0` turns the flag off so the non-admin view
 * can be checked without a second server.
 */
const hostPinia = createPinia()
const useHostAuth = defineStore('auth', () => ({
    user: ref<{ is_admin: boolean } | null>({ is_admin: params.get('admin') !== '0' }),
}))
useHostAuth(hostPinia)

const hostContext: PluginHostContext = {
    api: createMockApi(),
    pinia: hostPinia,
    theme: 'light',
    locale,
    route: { path: '/apps/usage', params: {}, query: {} },
    router: null,
}

const target = document.getElementById('app')
if (target) {
    const app = createApp(App, { hostContext })
    app.use(createPinia())
    app.use(createPluginI18n(locale))
    app.config.globalProperties.$host = hostContext
    app.mount(target)
}
