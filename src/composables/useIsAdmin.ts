import { computed, type ComputedRef } from 'vue'
import type { PluginHostContext } from '../shims'
import { hostAuthStore } from '../lib/host-auth'
import { useUsageStore } from '../stores/usage'

/**
 * Whether the caller may open the admin tabs.
 *
 * The host's auth store is the cheap answer, and the API is the real gate:
 * a 403 on an admin call flips `adminDenied` and the admin tabs disappear
 * rather than offering a retry that would be refused the same way.
 *
 * The shell and the tabs both need the answer, so it lives here: two
 * copies of the question are two places for it to drift.
 */
export function useIsAdmin(hostContext: PluginHostContext): ComputedRef<boolean> {
    const store = useUsageStore()
    return computed(() => {
        if (store.adminDenied) {
            return false
        }
        return hostAuthStore(hostContext.pinia)?.user?.is_admin === true
    })
}
