/**
 * App 层生物识别门控。保险箱密钥条目要随 iCloud 同步，无法用 Keychain
 * 条目级 SecAccessControl，因此在使用密钥前统一过这道门（密码管理器通行做法）。
 */

import * as LocalAuthentication from "expo-local-authentication";

export type VaultAuthResult = "ok" | "cancelled" | "unavailable";

/**
 * 请求生物识别（Face ID / Touch ID / Android BiometricPrompt），
 * 允许回退设备锁屏密码。连锁屏密码都没设 → unavailable，
 * 保险箱功能不可用（引导用户去系统设置）。
 */
export async function authenticateForVault(
	reason: string,
): Promise<VaultAuthResult> {
	const level = await LocalAuthentication.getEnrolledLevelAsync();
	if (level === LocalAuthentication.SecurityLevel.NONE) return "unavailable";
	const result = await LocalAuthentication.authenticateAsync({
		promptMessage: reason,
		cancelLabel: "取消",
		disableDeviceFallback: false,
	});
	return result.success ? "ok" : "cancelled";
}
