import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UsageDefaultLimits, UsageDefaultsResponse, UsagePrincipalSummary, UsageTab } from '../types'
import type { PluginHostContext } from '../shims'
import { isForbidden, messageOf } from '../lib/errors'
import { principalsPath, defaultsPath } from '../lib/usage-api'
import { toDefaultLimits } from '../lib/defaults'

/**
 * The plugin's own state.
 *
 * The panel keeps four things that outlive a single tab: which tab is
 * open, which principal the admin tabs are scoped to, the principals
 * of the installation, and the default limit sets. The selection crosses
 * tab boundaries — the picker picks it, the Limits and Budget tabs read
 * it — so it lives in the plugin's local Pinia rather than in a prop chain
 * the shell would have to thread through.
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
 *
 * `defaults` are the default limit sets, and they are held here rather
 * than in the tab that edits them because two tabs need them: the Defaults
 * tab writes them, and the Limits tab has to name the default that
 * governs the principal it is showing. They are read once and kept, for
 * the same reason the principals are: a second tab asks the server
 * nothing.
 */
export const useUsageStore = defineStore('usage', () => {
    const activeTab = ref<UsageTab>('overview')
    const selectedPrincipalId = ref<number | null>(null)
    const principals = ref<UsagePrincipalSummary[]>([])
    const principalsLoaded = ref(false)
    const principalsLoading = ref(false)
    const principalsError = ref<string | null>(null)
    const defaults = ref<UsageDefaultLimits>({ all: [], user: [], group: [] })
    const defaultsLoaded = ref(false)
    const defaultsLoading = ref(false)
    const defaultsError = ref<string | null>(null)
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

    /**
     * The default limit sets, one per scope.
     *
     * Admin-only, like the principals: a 403 is the server's answer rather
     * than a failure, and the admin tabs go away. The sets are read once
     * and kept — the Limits tab names the default that governs a
     * principal, and the Defaults tab edits them, so the second of the
     * two to open asks the server nothing.
     */
    async function loadDefaults(api: PluginHostContext['api']): Promise<void> {
        if (defaultsLoaded.value || defaultsLoading.value) {
            return
        }
        defaultsLoading.value = true
        defaultsError.value = null
        try {
            const response = await api.get<UsageDefaultsResponse>(defaultsPath())
            defaults.value = toDefaultLimits(response.defaults)
            defaultsLoaded.value = true
        } catch (e) {
            if (isForbidden(e)) {
                markAdminDenied()
                return
            }
            defaultsError.value = messageOf(e)
        } finally {
            defaultsLoading.value = false
        }
    }

    /**
     * The sets as they are stored.
     *
     * The Defaults tab writes the answer of its save back here, so the
     * Limits tab names the default the operator has just stored rather
     * than the one it read when it opened.
     */
    function setDefaults(sets: UsageDefaultLimits): void {
        defaults.value = toDefaultLimits(sets)
        defaultsLoaded.value = true
    }

    return {
        activeTab,
        selectedPrincipalId,
        selectedPrincipal,
        principals,
        principalsLoaded,
        principalsLoading,
        principalsError,
        defaults,
        defaultsLoaded,
        defaultsLoading,
        defaultsError,
        adminDenied,
        selectTab,
        selectPrincipal,
        markAdminDenied,
        loadPrincipals,
        loadDefaults,
        setDefaults,
    }
})
