import * as Haptics from 'expo-haptics';

/**
 * 轻量 haptic 封装：语义化触发 + 吞掉异常。
 * 不支持的设备 / 平台（如模拟器、关闭了系统触感）直接静默，绝不影响主流程。
 */

/** 切换选项、切换筛选：最轻的「选中」反馈。 */
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => undefined);
}

/** 打开面板、次要确认：轻微撞击。 */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** 完成任务、保存成功：成功通知反馈。 */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
