import { useI18n } from 'vue-i18n'
import type { LimitMode, LimitUnit, LimitWindow, PrincipalType } from '../types'

/**
 * The vocabulary of the panel, translated.
 *
 * The labels live here rather than in a plain module because `t()` needs a
 * component context: a module-scope translation would have to carry the
 * composer around, and the panel's copy is rendered inside components
 * anyway.
 */
export function useUsageLabels() {
    const { t } = useI18n()

    const windowLabel: Record<LimitWindow, string> = {
        hour: t('Hour'),
        day: t('Day'),
        week: t('Week'),
        month: t('Month'),
        rolling: t('Rolling'),
        total: t('Total'),
    }

    const unitLabel: Record<LimitUnit, string> = {
        credits: t('Credits'),
        total_tokens: t('Total tokens'),
        output_tokens: t('Output tokens'),
        llm_calls: t('LLM calls'),
        tool_calls: t('Tool calls'),
    }

    const modeLabel: Record<LimitMode, string> = {
        hard: t('Hard'),
        soft: t('Soft'),
    }

    const principalTypeLabel: Record<PrincipalType, string> = {
        user: t('User'),
        group: t('Group'),
    }

    return { windowLabel, unitLabel, modeLabel, principalTypeLabel }
}
