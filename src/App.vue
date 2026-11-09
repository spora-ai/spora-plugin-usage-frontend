<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from './shims'
import { hostAuthStore } from './lib/host-auth'
import { useUsageStore } from './stores/usage'
import UsageTabBar from './components/UsageTabBar.vue'
import OverviewTab from './components/OverviewTab.vue'
import PrincipalsTab from './components/PrincipalsTab.vue'
import LimitsTab from './components/LimitsTab.vue'
import BudgetTab from './components/BudgetTab.vue'
import PricesTab from './components/PricesTab.vue'

import './style.css'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t } = useI18n()
const store = useUsageStore()

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

watch(isAdmin, (admin) => {
    if (!admin && store.activeTab !== 'overview') {
        store.selectTab('overview')
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

        <UsageTabBar
            :active="store.activeTab"
            :is-admin="isAdmin"
            @select="store.selectTab"
        />

        <main class="flex flex-col gap-6">
            <OverviewTab
                v-if="store.activeTab === 'overview'"
                :host-context="hostContext"
            />
            <PrincipalsTab
                v-else-if="store.activeTab === 'principals'"
                :host-context="hostContext"
            />
            <LimitsTab
                v-else-if="store.activeTab === 'limits'"
                :host-context="hostContext"
            />
            <BudgetTab
                v-else-if="store.activeTab === 'budget'"
                :host-context="hostContext"
            />
            <PricesTab
                v-else-if="store.activeTab === 'prices'"
                :host-context="hostContext"
            />
        </main>
    </div>
</template>
