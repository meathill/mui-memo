import { Alert } from 'react-native';
import { api } from '@/lib/api';
import { replaceTasksEverywhere } from '@/lib/task-sync';
import type { PendingConfirm } from '@/store';

/**
 * MODIFY / DONE 命中时的确认逻辑。原本内联在今天页，现抽成纯逻辑放全局：
 * pump 在后台逐条处理时，确认弹窗必须脱离页面生命周期，否则用户不在今天页就
 * 弹不出来，pump 会因 `pendingConfirms` 非空而永久卡住。
 *
 * 「取消」分支不调后端（后端本来就没改 DB），其余 hydrate 回吐的最新任务列表。
 */
export type ConfirmChoice = 'confirm' | 'modify-as-add' | 'cancel';

export function showConfirm(pc: PendingConfirm, onChoose: (choice: ConfirmChoice) => void): void {
  const { effect } = pc;
  if (effect.kind === 'modify') {
    const before = effect.before.text ?? effect.text;
    const after = effect.patch.text ?? before;
    const body = before !== after ? `「${before}」 → 「${after}」` : `「${effect.text}」 ${effect.verb}`;
    Alert.alert('要把任务改成这样吗？', body, [
      { text: '取消', style: 'cancel', onPress: () => onChoose('cancel') },
      { text: '改为新增', style: 'default', onPress: () => onChoose('modify-as-add') },
      { text: '确认', style: 'default', onPress: () => onChoose('confirm') },
    ]);
  } else if (effect.kind === 'done') {
    Alert.alert('确认完成？', `「${effect.text}」`, [
      { text: '取消', style: 'cancel', onPress: () => onChoose('cancel') },
      { text: '确认', style: 'default', onPress: () => onChoose('confirm') },
    ]);
  } else {
    onChoose('cancel');
  }
}

export async function applyConfirm(pc: PendingConfirm, choice: ConfirmChoice): Promise<void> {
  const { effect, utterance } = pc;
  if (choice === 'cancel') return;
  if (effect.kind === 'modify') {
    const body =
      choice === 'confirm'
        ? { kind: 'modify' as const, taskId: effect.id, patch: effect.patch as Record<string, unknown> }
        : {
            kind: 'modify-as-add' as const,
            rawText: utterance.raw,
            task: { ...effect.before, ...effect.patch } as Record<string, unknown>,
            aiReason: effect.reason,
          };
    const { tasks } = await api.intent.confirm(body);
    await replaceTasksEverywhere(tasks);
  } else if (effect.kind === 'done' && choice === 'confirm') {
    const { tasks } = await api.intent.confirm({ kind: 'done', taskId: effect.id });
    await replaceTasksEverywhere(tasks);
  }
}
