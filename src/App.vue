<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from './shims'
import { hostAuthStore } from './lib/host-auth'
import { principalsPath } from './lib/usage-api'
import { isForbidden, messageOf } from './lib/errors'
import type { UsagePrincipalSummary } from './types'
import { useUsageStore } from './stores/usage'
import UsageTabBar from './components/UsageTabBar.vue'
import PrincipalScope from './components/PrincipalScope.vue'
import OverviewTab from './components/OverviewTab.vue'
import LimitsTab from './components/LimitsTab.vue'
import BudgetTab from './components/BudgetTab.vue'
import PricesTab from './components/PricesTab.vue'

import './style.css'

const props = defineProps<{ hostContext: PluginHostContext; idPrefix: string }>()

const { t } = useI18n()
const store = useUsageStore()

const scopeError = ref<string | null>(null)
const scopeLoading = ref(false)
const scopeLoaded = ref(false)

/**
 * Whether the caller may open the admin tabs.
 *
 * The host's auth store is the cheap answer, and the API is the real gate:
 * a 403 on an admin call flips `adminDenied` and the admin tabs disappear
 * rather than offering a retry that would be refused the same way.
 */
const isAdmin = computed(() => {
    if (store.adminDenied) {
        return false
    }
    return hostAuthStore(props.hostContext.pinia)?.user?.is_admin === true
})

/**
 * The principals the scope dropdown offers.
 *
 * Every principal on the installation: the admin configures any of them,
 * so the scope is the whole install and not the caller's own. A 403 means
 * the caller is not an admin after all — the same answer the tabs act on.
 */
async function loadScope(): Promise<void> {
    if (scopeLoaded.value || scopeLoading.value) {
        return
    }
    scopeLoading.value = true
    scopeError.value = null
    try {
        const response = await props.hostContext.api.get<{ principals: UsagePrincipalSummary[] }>(
            principalsPath(),
        )
        store.setPrincipals(response.principals ?? [])
        scopeLoaded.value = true
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        scopeError.value = messageOf(e)
    } finally {
        scopeLoading.value = false
    }
}

/**
 * The scope is an admin control: the tabs it scopes are admin tabs, and a
 * dropdown that scoped nothing would be a control that does nothing.
 *
 * The list is loaded when the caller turns out to be an admin — the host's
 * auth store may not have the user yet when this panel mounts.
 */
watch(
    isAdmin,
    (admin) => {
        if (admin) {
            void loadScope()
            return
        }
        if (store.activeTab !== 'overview') {
            store.selectTab('overview')
        }
    },
    { immediate: true },
)

onMounted(() => {
    if (isAdmin.value) {
        void loadScope()
    }
})
</script>

<template>
    <div id="spora-plugin-usage" class="flex flex-col gap-6 text-foreground">
        <header class="flex flex-col gap-1">
            <h1 class="text-xl font-semibold">{{ t('Usage') }}</h1>
            <p class="text-sm text-muted-foreground">
                {{ t('What your agents spend, what they may spend, and what it costs.') }}
            </p>
        </header>

        <!-- The scope and the tabs share one sticky row: the scope is what
             the admin tabs are about, so it has to stay on screen while
             they are open. -->
        <div
            class="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            data-testid="usage-toolbar"
        >
            <PrincipalScope v-if="isAdmin" :id-prefix="idPrefix" />
            <UsageTabBar
                :active="store.activeTab"
                :is-admin="isAdmin"
                :id-prefix="idPrefix"
                @select="store.selectTab"
            />
        </div>

        <p
            v-if="scopeError"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-scope-error"
        >
            {{ t('Failed to load principals: {error}', { error: scopeError }) }}
        </p>
        <p
            v-else-if="isAdmin && scopeLoading"
            class="text-sm text-muted-foreground"
            data-testid="usage-scope-loading"
        >
            {{ t('Loading usage…') }}
        </p>

        <main class="flex flex-col gap-6">
            <!-- The panel is the tab's content, so the tab points at it and
                 the panel names the tab it belongs to. -->
            <div
                :id="`${idPrefix}-panel-${store.activeTab}`"
                role="tabpanel"
                :aria-labelledby="`${idPrefix}-tab-${store.activeTab}`"
            >
                <OverviewTab
                    v-if="store.activeTab === 'overview'"
                    :host-context="hostContext"
                />
                <LimitsTab
                    v-else-if="store.activeTab === 'limits'"
                    :host-context="hostContext"
                    :id-prefix="idPrefix"
                />
                <BudgetTab
                    v-else-if="store.activeTab === 'budget'"
                    :host-context="hostContext"
                    :id-prefix="idPrefix"
                />
                <PricesTab
                    v-else-if="store.activeTab === 'prices'"
                    :host-context="hostContext"
                    :id-prefix="idPrefix"
                />
            </div>
        </main>
    </div>
</template>
