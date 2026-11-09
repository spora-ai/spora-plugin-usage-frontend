import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UsageTab } from '../types'

/**
 * The plugin's own state.
 *
 * The panel keeps two things that outlive a single tab: which tab is open
 * and which principal the admin tabs are scoped to. The selection crosses
 * tab boundaries — the Principals tab picks it, the Limits and Budget tabs
 * read it — so it lives in the plugin's local Pinia rather than in a prop
 * chain the shell would have to thread through.
 *
 * `adminDenied` records that the API refused an admin call. The API is the
 * real gate: a 403 means the caller is not an admin, so the admin tabs hide
 * instead of offering a retry that would be refused the same way.
 */
export const useUsageStore = defineStore('usage', () => {
    const activeTab = ref<UsageTab>('overview')
    const selectedPrincipalId = ref<number | null>(null)
    const adminDenied = ref(false)

    function selectTab(tab: UsageTab): void {
        activeTab.value = tab
    }

    function selectPrincipal(id: number | null): void {
        selectedPrincipalId.value = id
    }

    function markAdminDenied(): void {
        adminDenied.value = true
    }

    return {
        activeTab,
        selectedPrincipalId,
        adminDenied,
        selectTab,
        selectPrincipal,
        markAdminDenied,
    }
})
