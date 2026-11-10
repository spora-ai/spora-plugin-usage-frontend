import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UsagePrincipalSummary, UsageTab } from '../types'

/**
 * The plugin's own state.
 *
 * The panel keeps two things that outlive a single tab: which tab is open
 * and which principal the admin tabs are scoped to. The selection crosses
 * tab boundaries — the scope dropdown picks it, the Limits and Budget tabs
 * read it — so it lives in the plugin's local Pinia rather than in a prop
 * chain the shell would have to thread through.
 *
 * `principals` is the list the scope dropdown offers: every principal on
 * the installation, for the admin who configures them. The dropdown is the
 * **only** way to pick one — a principal that could be selected from inside
 * a tab would have its scope hidden while the operator worked on it, and
 * the panel would be about a principal whose name is nowhere on screen.
 *
 * `adminDenied` records that the API refused an admin call. The API is the
 * real gate: a 403 means the caller is not an admin, so the admin tabs hide
 * instead of offering a retry that would be refused the same way.
 */
export const useUsageStore = defineStore('usage', () => {
    const activeTab = ref<UsageTab>('overview')
    const selectedPrincipalId = ref<number | null>(null)
    const principals = ref<UsagePrincipalSummary[]>([])
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

    function setPrincipals(list: UsagePrincipalSummary[]): void {
        principals.value = list
    }

    function markAdminDenied(): void {
        adminDenied.value = true
    }

    return {
        activeTab,
        selectedPrincipalId,
        selectedPrincipal,
        principals,
        adminDenied,
        selectTab,
        selectPrincipal,
        setPrincipals,
        markAdminDenied,
    }
})
