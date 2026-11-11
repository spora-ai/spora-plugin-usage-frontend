import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { PluginHostContext } from './shims'
import { createPluginI18n } from './i18n'
import { nextIdPrefix } from './lib/ids'

/**
 * The plugin mount contract.
 *
 * The IIFE lib wrapper installs this on `window.SporaAppUsage`; the host's
 * `apps/registry.ts` calls `mount` and `unmount` when `/apps/usage` is
 * mounted and unmounted.
 *
 * The plugin installs a *local* Pinia for its own state — the open tab and
 * the selected principal — so nothing here lands in the host's stores. The
 * host's own services (auth) are reached through the Pinia instance the
 * host passes in `hostContext.pinia`.
 *
 * `mount()` may be sync or async; the registry awaits a thenable, so a
 * plugin may do async setup before returning.
 */
const SporaApp = {
    mount(target: HTMLElement, hostContext: PluginHostContext): void {
        // Each mount gets its own id namespace: the host may mount this
        // bundle into more than one slot, and the panel's labels point at
        // control ids.
        const app = createApp(App, { hostContext, idPrefix: nextIdPrefix() })
        const localPinia = createPinia()
        app.use(localPinia)
        // The plugin owns its catalogue, so it builds its own instance —
        // the host does not publish its own. The host's locale is only
        // the initial value.
        app.use(createPluginI18n(hostContext.locale))
        // Stash the host's context on `globalProperties` so any component
        // can reach it via `this.$host` without polluting `provide`/`inject`
        // keys that the host also uses.
        app.config.globalProperties.$host = hostContext
        app.mount(target)
        // Keep a back-reference so `unmount` finds the right app even if the
        // host mounts the same bundle into multiple slots.
        ;(target as HTMLElement & { __sporaApp?: { unmount: () => void } }).__sporaApp = {
            unmount: () => {
                app.unmount()
            },
        }
    },

    unmount(target: HTMLElement): void {
        const ref = (target as HTMLElement & { __sporaApp?: { unmount: () => void } }).__sporaApp
        if (ref) {
            ref.unmount()
            delete (target as HTMLElement & { __sporaApp?: { unmount: () => void } }).__sporaApp
        }
    },
}

// Vite's IIFE lib wrapper installs the value at `window.<lib.name>` when
// `build.lib.name = 'SporaAppUsage'`. We additionally assign here for the
// dev-mode entry (which doesn't go through `vite build --lib`).
window.SporaAppUsage = SporaApp

export default SporaApp
