<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type {
    UsageLimitDraft,
    UsageLimitRow,
    UsageLimitsResponse,
    UsagePrincipalDetail,
} from '../types'
import { limitsPath, principalPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatCredits, formatTokens } from '../lib/format'
import { useUsageStore } from '../stores/usage'
import LimitRowEditor from './LimitRowEditor.vue'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t, locale } = useI18n()
const store = useUsageStore()

const detail = ref<UsagePrincipalDetail | null>(null)
const rows = ref<UsageLimitDraft[]>([])
const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saved = ref(false)

const principalId = computed(() => store.selectedPrincipalId)

/**
 * The body of the save: the limit rows without the figures the server
 * computed. The server replaces the whole set, so what the panel does not
 * send is what the principal no longer has.
 */
function toInput(limit: UsageLimitDraft): UsageLimitRow {
    return {
        window: limit.window,
        window_size: limit.window_size,
        unit: limit.unit,
        cap: limit.cap,
        mode: limit.mode,
        enabled: limit.enabled,
    }
}

async function load(id: number): Promise<void> {
    loading.value = true
    loadError.value = null
    saved.value = false
    try {
        const response = await props.hostContext.api.get<UsagePrincipalDetail>(principalPath(id))
        detail.value = response
        rows.value = (response.limits ?? []).map((limit) => ({ ...limit }))
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        loadError.value = messageOf(e)
        detail.value = null
        rows.value = []
    } finally {
        loading.value = false
    }
}

function updateRow(index: number, limit: UsageLimitDraft): void {
    rows.value = rows.value.map((row, position) => (position === index ? limit : row))
}

/**
 * A new row starts at a cap of zero and carries no figures: the cap is
 * the operator's to type, and the server computes the figures of a row it
 * has not seen.
 */
function addRow(): void {
    rows.value = [
        ...rows.value,
        {
            window: 'month',
            window_size: 1,
            unit: 'credits',
            cap: 0,
            mode: 'hard',
            enabled: true,
            spend: null,
            remaining: null,
        },
    ]
}

function removeRow(index: number): void {
    rows.value = rows.value.filter((_row, position) => position !== index)
}

async function save(): Promise<void> {
    const id = principalId.value
    if (id === null) {
        return
    }
    saving.value = true
    saveError.value = null
    saved.value = false
    try {
        await props.hostContext.api.put<UsageLimitsResponse>(limitsPath(id), {
            limits: rows.value.map(toInput),
        })
        // The server answers with the rows it stored, but the figures it
        // computed come with the principal's own read — so the panel asks
        // for them again instead of showing the drafts' stale ones.
        await load(id)
        saved.value = true
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        saveError.value = messageOf(e)
    } finally {
        saving.value = false
    }
}

watch(
    principalId,
    (id) => {
        detail.value = null
        rows.value = []
        if (id === null) {
            return
        }
        void load(id)
    },
    { immediate: true },
)
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-limits">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Limits') }}</h2>
            <p class="text-sm text-muted-foreground">
                {{ t('The limits of the selected principal, and what each window has spent so far.') }}
            </p>
        </header>

        <div
            v-if="principalId === null"
            class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="usage-limits-no-principal"
        >
            {{ t('Pick a principal in the Principals tab first.') }}
        </div>
        <div
            v-else-if="loading"
            class="text-sm text-muted-foreground"
            data-testid="usage-limits-loading"
        >
            {{ t('Loading limits…') }}
        </div>
        <div
            v-else-if="loadError"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-limits-error"
        >
            {{ t('Failed to load limits: {error}', { error: loadError }) }}
        </div>

        <template v-else>
            <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <div class="flex flex-col">
                    <span class="text-xs uppercase tracking-wide text-muted-foreground">
                        {{ t('Selected principal') }}
                    </span>
                    <span
                        class="font-medium"
                        data-testid="usage-limits-principal"
                    >
                        {{ detail?.principal.name ?? `#${principalId}` }}
                    </span>
                </div>
                <div class="flex flex-wrap gap-6">
                    <div class="flex flex-col">
                        <span class="text-xs uppercase tracking-wide text-muted-foreground">
                            {{ t('Credits (30 days)') }}
                        </span>
                        <span
                            class="font-medium"
                            data-testid="usage-limits-credits-30d"
                        >
                            {{ formatCredits(detail?.spend.credits_30d ?? null, locale) }}
                        </span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs uppercase tracking-wide text-muted-foreground">
                            {{ t('Total tokens (30 days)') }}
                        </span>
                        <span
                            class="font-medium"
                            data-testid="usage-limits-tokens-30d"
                        >
                            {{ formatTokens(detail?.spend.total_tokens_30d ?? null, locale) }}
                        </span>
                    </div>
                </div>
            </section>

            <section class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold">{{ t('Limit rows') }}</h3>
                    <button
                        type="button"
                        class="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                        data-testid="usage-limits-add"
                        @click="addRow"
                    >
                        {{ t('Add limit') }}
                    </button>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ t('The cap is always a number: at 0 there is nothing left to spend. Remove the row to have no limit.') }}
                </p>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                <th class="py-2 pr-2 font-medium">{{ t('Window') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Unit') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Limit') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Mode') }}</th>
                                <th class="py-2 pr-2 text-right font-medium">{{ t('Spent / left') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('On') }}</th>
                                <th class="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            <LimitRowEditor
                                v-for="(row, index) in rows"
                                :key="index"
                                :limit="row"
                                :index="index"
                                :locale="locale"
                                @change="updateRow(index, $event)"
                                @remove="removeRow(index)"
                            />
                            <tr v-if="rows.length === 0">
                                <td colspan="7" class="py-3 text-sm text-muted-foreground">
                                    {{ t('No limits are set.') }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="saving"
                        data-testid="usage-limits-save"
                        @click="save"
                    >
                        {{ saving ? t('Saving…') : t('Save limits') }}
                    </button>
                    <span
                        v-if="saved"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-limits-saved"
                    >
                        {{ t('Limits saved.') }}
                    </span>
                    <span
                        v-if="saveError"
                        class="text-sm text-destructive"
                        data-testid="usage-limits-save-error"
                    >
                        {{ saveError }}
                    </span>
                </div>
            </section>
        </template>
    </div>
</template>
