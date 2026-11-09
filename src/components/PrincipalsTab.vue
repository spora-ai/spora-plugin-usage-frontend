<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type { UsagePrincipalSummary } from '../types'
import { principalsPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatCredits } from '../lib/format'
import { useUsageLabels } from '../composables/useUsageLabels'
import { useUsageStore } from '../stores/usage'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t, locale } = useI18n()
const labels = useUsageLabels()
const store = useUsageStore()

const principals = ref<UsagePrincipalSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
        const response = await props.hostContext.api.get<{ principals: UsagePrincipalSummary[] }>(
            principalsPath(),
        )
        principals.value = response.principals ?? []
    } catch (e) {
        // A 403 is the server's answer to "you are not an admin", not a
        // failure worth a retry: the shell hides the admin tabs instead.
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        error.value = messageOf(e)
    } finally {
        loading.value = false
    }
}

function select(id: number): void {
    store.selectPrincipal(id)
}

onMounted(() => {
    void load()
})
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-principals">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Principals') }}</h2>
            <p class="text-sm text-muted-foreground">
                {{ t('Every principal on this installation, its balance and its 30-day spend.') }}
            </p>
            <p class="text-sm text-muted-foreground">
                {{ t('Selecting a principal scopes the Limits and Budget tabs.') }}
            </p>
        </header>

        <div
            v-if="loading"
            class="text-sm text-muted-foreground"
            data-testid="usage-principals-loading"
        >
            {{ t('Loading principals…') }}
        </div>
        <div
            v-else-if="error"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-principals-error"
        >
            {{ t('Failed to load principals: {error}', { error }) }}
        </div>
        <div
            v-else-if="principals.length === 0"
            class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="usage-principals-empty"
        >
            {{ t('No principals yet.') }}
        </div>

        <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th class="py-2 pr-3 font-medium">{{ t('Name') }}</th>
                        <th class="py-2 pr-3 font-medium">{{ t('Type') }}</th>
                        <th class="py-2 pr-3 text-right font-medium">{{ t('Balance') }}</th>
                        <th class="py-2 pr-3 text-right font-medium">{{ t('Spend (30 days)') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="principal in principals"
                        :key="principal.id"
                        class="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                        :class="principal.id === store.selectedPrincipalId ? 'bg-muted/60' : ''"
                        :data-testid="`usage-principal-row-${principal.id}`"
                        @click="select(principal.id)"
                    >
                        <td class="py-2 pr-3">
                            <button
                                type="button"
                                class="text-left font-medium hover:underline"
                                :data-testid="`usage-principal-select-${principal.id}`"
                                @click.stop="select(principal.id)"
                            >
                                {{ principal.name }}
                            </button>
                        </td>
                        <td class="py-2 pr-3 text-muted-foreground">
                            {{ labels.principalTypeLabel[principal.type] }}
                        </td>
                        <td class="py-2 pr-3 text-right">
                            {{ principal.balance === null
                                ? t('No credit pool')
                                : formatCredits(principal.balance, locale) }}
                        </td>
                        <td class="py-2 pr-3 text-right">
                            {{ formatCredits(principal.spend_30d, locale) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
