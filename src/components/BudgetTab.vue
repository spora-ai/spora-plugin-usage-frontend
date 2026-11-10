<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type { UsageBalanceResponse, UsagePrincipalDetail } from '../types'
import { creditsPath, principalPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { formatCredits } from '../lib/format'
import { useUsageStore } from '../stores/usage'

const props = defineProps<{ hostContext: PluginHostContext; idPrefix: string }>()

const { t, locale } = useI18n()
const store = useUsageStore()

const principalId = computed(() => store.selectedPrincipalId)

/**
 * The scope's name, for the panel's own heading.
 *
 * It comes from the scope dropdown's list, so the heading names the
 * principal before the panel's own read has answered.
 */
const scopeName = computed(() => store.selectedPrincipal?.name ?? null)

/** The name the panel's own read of the principal carries. */
const detailName = ref<string | null>(null)

/**
 * The name on the principal card.
 *
 * The panel's own read is the authority on who this is; the scope's name
 * is the fallback for the moment before the read has answered.
 */
const principalName = computed(() => detailName.value ?? scopeName.value ?? null)
const balance = ref<number | null>(null)
const amount = ref<number | null>(null)
const note = ref('')
const loading = ref(false)
const granting = ref(false)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const granted = ref(false)

/**
 * The text of the amount field.
 *
 * A number field cannot hold the amount the operator is typing: "100.50"
 * parses as 100 until the last digit is there, and a field bound to that
 * number is rewritten under the cursor. The text is therefore the field's
 * own, and the amount is what the grant sends.
 */
const amountText = ref('')

async function load(id: number): Promise<void> {
    loading.value = true
    loadError.value = null
    granted.value = false
    try {
        const response = await props.hostContext.api.get<UsagePrincipalDetail>(principalPath(id))
        detailName.value = response.principal.name
        balance.value = response.balance
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        loadError.value = messageOf(e)
        detailName.value = null
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
        clearAmount()
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

/**
 * Empty the amount field.
 *
 * The grant has taken the amount, so the text goes with the number: a
 * field that kept its text would look filled while the grant refuses an
 * empty amount.
 */
function clearAmount(): void {
    amount.value = null
    amountText.value = ''
}

function setAmount(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
    amountText.value = raw
    amount.value = raw.trim() === '' ? null : Number(raw)
}

function setNote(event: Event): void {
    note.value = (event.target as HTMLInputElement).value
}

watch(
    principalId,
    (id) => {
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
                <!-- The scope is named here as well as in the dropdown: this
                     panel is about one principal, and the operator should
                     not have to look up to know which one. -->
                <span v-if="scopeName">{{ t('The credit balance of {name}, and the grants that moved it.', { name: scopeName }) }}</span>
                <span v-else>{{ t('The credit balance of the selected principal, and the grants that moved it.') }}</span>
            </p>
        </header>

        <div
            v-if="principalId === null"
            class="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="usage-budget-no-principal"
        >
            {{ t('Choose a principal above to see its balance.') }}
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
                        :for="`${idPrefix}-grant-amount`"
                        class="text-sm font-medium"
                    >
                        {{ t('Amount') }}
                    </label>
                    <input
                        :id="`${idPrefix}-grant-amount`"
                        type="number"
                        step="any"
                        class="w-48 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        :value="amountText"
                        data-testid="usage-grant-amount"
                        @input="setAmount"
                    >
                    <p class="text-xs text-muted-foreground">
                        {{ t('A positive number adds credits, a negative one takes them away.') }}
                    </p>
                </div>
                <div class="flex flex-col gap-1">
                    <label
                        :for="`${idPrefix}-grant-note`"
                        class="text-sm font-medium"
                    >
                        {{ t('Note') }}
                    </label>
                    <input
                        :id="`${idPrefix}-grant-note`"
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
