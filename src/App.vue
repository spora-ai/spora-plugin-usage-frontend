<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from './shims'
import { useIsAdmin } from './composables/useIsAdmin'
import { useUsageStore } from './stores/usage'
import UsageTabBar from './components/UsageTabBar.vue'
import OverviewTab from './components/OverviewTab.vue'
import LimitsTab from './components/LimitsTab.vue'
import BudgetTab from './components/BudgetTab.vue'
import PricesTab from './components/PricesTab.vue'

import './style.css'

const props = defineProps<{ hostContext: PluginHostContext; idPrefix: string }>()

const { t } = useI18n()
const store = useUsageStore()
const isAdmin = useIsAdmin(props.hostContext)

/**
 * The shell carries no control of its own.
 *
 * The principal picker belongs to the tabs it scopes — a dropdown in the
 * toolbar would scope a panel that is not on screen, and the Overview is
 * about nobody in particular. The shell keeps the tabs and hands the
 * Overview the whole installation.
 *
 * A caller who is not an admin lands on the Overview: the admin tabs are
 * not theirs to open.
 */
watch(
    isAdmin,
    (admin) => {
        if (admin) {
            return
        }
        if (store.activeTab !== 'overview') {
            store.selectTab('overview')
        }
    },
    { immediate: true },
)
</script>

<template>
    <div id="spora-plugin-usage" class="flex flex-col gap-6 text-foreground">
        <header class="flex flex-col gap-1">
            <h1 class="text-xl font-semibold">{{ t('Usage') }}</h1>
            <p class="text-sm text-muted-foreground">
                {{ t('What your agents spend, what they may spend, and what it costs.') }}
            </p>
        </header>

        <!-- Only the tabs: every control the shell would hold is scoped to
             a panel, and the panel carries it. -->
        <div
            class="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            data-testid="usage-toolbar"
        >
            <UsageTabBar
                :active="store.activeTab"
                :is-admin="isAdmin"
                :id-prefix="idPrefix"
                @select="store.selectTab"
            />
        </div>

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
