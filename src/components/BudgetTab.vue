<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type { UsageBalanceResponse, UsagePrincipalDetail } from '../types'
import { creditsPath, principalPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatCredits } from '../lib/format'
import { useUsageStore } from '../stores/usage'

const props = defineProps<{ hostContext: PluginHostContext }>()

const { t, locale } = useI18n()
const store = useUsageStore()

const principalId = computed(() => store.selectedPrincipalId)
const principalName = ref<string | null>(null)
const balance = ref<number | null>(null)
const amount = ref<number | null>(null)
const note = ref('')
const loading = ref(false)
const granting = ref(false)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const granted = ref(false)

async function load(id: number): Promise<void> {
    loading.value = true
    loadError.value = null
    granted.value = false
    try {
        const response = await props.hostContext.api.get<UsagePrincipalDetail>(principalPath(id))
        principalName.value = response.principal.name
        balance.value = response.balance
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        loadError.value = messageOf(e)
        principalName.value = null
        balance.value = null
    } finally {
        loading.value = false
    }
}

async function grant(): Promise<void> {
    const id = principalId.value
    if (id === null) {
        return
    }
    if (amount.value === null || amount.value === 0) {
        actionError.value = t('Enter an amount to grant.')
        return
    }
    granting.value = true
    actionError.value = null
    granted.value = false
    try {
        const response = await props.hostContext.api.put<UsageBalanceResponse>(
            creditsPath(id),
            { amount: amount.value, note: note.value },
        )
        balance.value = response.balance
        granted.value = true
        amount.value = null
        note.value = ''
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        actionError.value = messageOf(e)
    } finally {
        granting.value = false
    }
}

function setAmount(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
    amount.value = raw.trim() === '' ? null : Number(raw)
}

function setNote(event: Event): void {
    note.value = (event.target as HTMLInputElement).value
}

watch(
    principalId,
    (id) => {
        principalName.value = null
        balance.value = null
        granted.value = false
        if (id === null) {
            return
        }
        void load(id)
    },
    { immediate: true },
)
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-budget">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Budget') }}</h2>
            <p class="text-sm text-muted-foreground">
                {{ t('The credit balance of the selected principal, and the grants that moved it.') }}
            </p>
        </header>

        <div
            v-if="principalId === null"
            class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="usage-budget-no-principal"
        >
            {{ t('Pick a principal in the Principals tab first.') }}
        </div>
        <div
            v-else-if="loading"
            class="text-sm text-muted-foreground"
            data-testid="usage-budget-loading"
        >
            {{ t('Loading balance…') }}
        </div>
        <div
            v-else-if="loadError"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-budget-error"
        >
            {{ t('Failed to load usage: {error}', { error: loadError }) }}
        </div>

        <template v-else>
            <section class="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-border p-4">
                <div class="flex flex-col">
                    <span class="text-xs uppercase tracking-wide text-muted-foreground">
                        {{ t('Selected principal') }}
                    </span>
                    <span class="font-medium" data-testid="usage-budget-principal">
                        {{ principalName ?? `#${principalId}` }}
                    </span>
                </div>
                <div class="flex flex-col">
                    <span class="text-xs uppercase tracking-wide text-muted-foreground">
                        {{ t('Balance') }}
                    </span>
                    <span class="text-lg font-semibold" data-testid="usage-budget-balance">
                        {{ balance === null ? t('No credit pool') : formatCredits(balance, locale) }}
                    </span>
                </div>
            </section>

            <form
                class="flex flex-col gap-3 rounded-xl border border-border p-4"
                data-testid="usage-grant-form"
                @submit.prevent="grant"
            >
                <h3 class="text-sm font-semibold">{{ t('Grant credits') }}</h3>
                <div class="flex flex-col gap-1">
                    <label
                        for="usage-grant-amount"
                        class="text-sm font-medium"
                    >
                        {{ t('Amount') }}
                    </label>
                    <input
                        id="usage-grant-amount"
                        type="number"
                        step="any"
                        class="w-48 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        :value="amount ?? ''"
                        data-testid="usage-grant-amount"
                        @input="setAmount"
                    >
                    <p class="text-xs text-muted-foreground">
                        {{ t('A positive number adds credits, a negative one takes them away.') }}
                    </p>
                </div>
                <div class="flex flex-col gap-1">
                    <label
                        for="usage-grant-note"
                        class="text-sm font-medium"
                    >
                        {{ t('Note') }}
                    </label>
                    <input
                        id="usage-grant-note"
                        type="text"
                        class="w-80 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        :value="note"
                        data-testid="usage-grant-note"
                        @input="setNote"
                    >
                    <p class="text-xs text-muted-foreground">
                        {{ t('The grant is recorded with this note.') }}
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="granting"
                        data-testid="usage-grant-submit"
                    >
                        {{ granting ? t('Granting…') : t('Grant') }}
                    </button>
                    <span
                        v-if="granted"
                        class="text-sm text-muted-foreground"
                        data-testid="usage-grant-done"
                    >
                        {{ t('Credits granted.') }}
                    </span>
                    <span
                        v-if="actionError"
                        class="text-sm text-destructive"
                        data-testid="usage-budget-action-error"
                    >
                        {{ actionError }}
                    </span>
                </div>
            </form>
        </template>
    </div>
</template>
