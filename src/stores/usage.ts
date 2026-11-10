import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UsagePrincipalSummary, UsageTab } from '../types'
import type { PluginHostContext } from '../shims'
import { isForbidden, messageOf } from '../lib/errors'
import { principalsPath } from '../lib/usage-api'

/**
 * The plugin's own state.
 *
 * The panel keeps three things that outlive a single tab: which tab is
 * open, which principal the admin tabs are scoped to, and the principals
 * of the installation. The selection crosses tab boundaries — the picker
 * picks it, the Limits and Budget tabs read it — so it lives in the
 * plugin's local Pinia rather than in a prop chain the shell would have to
 * thread through.
 *
 * `principals` is the list the picker offers: every principal on the
 * installation, for the admin who configures them. The picker is the
 * **only** way to pick one — a principal that could be selected from
 * somewhere else would have its scope hidden while the operator worked on
 * it, and the panel would be about a principal whose name is nowhere on
 * screen.
 *
 * The listing is loaded once and kept: `principalsLoaded` is what stops
 * the Budget tab from asking again for a list the Limits tab already
 * holds, and `principalsLoading` keeps two tabs that mount at the same
 * moment from asking twice.
 *
 * `adminDenied` records that the API refused an admin call. The API is the
 * real gate: a 403 means the caller is not an admin, so the admin tabs hide
 * instead of offering a retry that would be refused the same way.
 */
export const useUsageStore = defineStore('usage', () => {
    const activeTab = ref<UsageTab>('overview')
    const selectedPrincipalId = ref<number | null>(null)
    const principals = ref<UsagePrincipalSummary[]>([])
    const principalsLoaded = ref(false)
    const principalsLoading = ref(false)
    const principalsError = ref<string | null>(null)
    const adminDenied = ref(false)

    const selectedPrincipal = computed<UsagePrincipalSummary | null>(
        () => principals.value.find((principal) => principal.id === selectedPrincipalId.value) ?? null,
    )

    function selectTab(tab: UsageTab): void {
        activeTab.value = tab
    }

    function selectPrincipal(id: number | null): void {
        selectedPrincipalId.value = id
    }

    function markAdminDenied(): void {
        adminDenied.value = true
    }

    /**
     * The principals of the installation.
     *
     * The listing is admin-only, so a 403 is the server's answer rather
     * than a failure: the caller is not an admin, and the admin tabs go
     * away. Anything else is a failure worth showing.
     */
    async function loadPrincipals(api: PluginHostContext['api']): Promise<void> {
        if (principalsLoaded.value || principalsLoading.value) {
            return
        }
        principalsLoading.value = true
        principalsError.value = null
        try {
            const response = await api.get<{ principals: UsagePrincipalSummary[] }>(
                principalsPath(),
            )
            principals.value = response.principals ?? []
            principalsLoaded.value = true
        } catch (e) {
            if (isForbidden(e)) {
                markAdminDenied()
                return
            }
            principalsError.value = messageOf(e)
        } finally {
            principalsLoading.value = false
        }
    }

    return {
        activeTab,
        selectedPrincipalId,
        selectedPrincipal,
        principals,
        principalsLoaded,
        principalsLoading,
        principalsError,
        adminDenied,
        selectTab,
        selectPrincipal,
        markAdminDenied,
        loadPrincipals,
    }
})
