/**
 * 保险箱门面：编排 Keychain 密钥 ←→ HSM 密文，供 screen 调用。
 *
 * 边界：这里不碰 api.ts / store / local-db——任务上 vaultKey 指针的
 * PATCH 与本地同步由 screen 负责（沿用 edit.tsx 的乐观更新模式）。
 * 调用前先过 authenticateForVault 门控（vault-biometric.ts）。
 *
 * 明文生命周期：只存在于本文件函数的参数/返回值与 screen 的 useState，
 * 禁入 zustand persist / SQLite / 日志 / task.text。
 */

import * as Crypto from "expo-crypto";
import { hsmDeleteKey, hsmGetKey, hsmPutKey } from "./vault-hsm";
import {
	deleteVaultSecret,
	ensureVaultSecret,
	getVaultSecret,
	setVaultSecret,
} from "./vault-keychain";
import {
	buildVaultPath,
	isValidRecoveryCode,
	normalizeRecoveryCode,
	VaultError,
} from "./vault-model";

async function requireSecret(userId: string): Promise<string> {
	const secret = await getVaultSecret(userId);
	if (!secret) throw new VaultError("no_secret");
	return secret;
}

/** 解锁读取明文。404 → not_found、密钥不符 → forbidden，UI 按矩阵处理。 */
export async function unlockVault(
	userId: string,
	vaultKey: string,
): Promise<string> {
	const secret = await requireSecret(userId);
	return hsmGetKey(buildVaultPath(userId, vaultKey), secret);
}

/**
 * 保存（新建或覆盖）。返回最终 vaultKey 与「密钥是否首次生成」标记
 * （createdSecret=true 时 screen 引导用户备份恢复码）。
 *
 * 更新已有条目遇 403 = 条目所有权属于换掉的旧密钥：自动 mint 新 UUID
 * 重试一次 PUT（这正是 vaultKey 独立于 taskId 的意义），旧条目沦为
 * 不可读垃圾；调用方拿到新 key 后 PATCH 回任务。
 */
export async function saveVault(
	userId: string,
	currentVaultKey: string | null,
	content: string,
): Promise<{ vaultKey: string; createdSecret: boolean }> {
	const { secret, created } = await ensureVaultSecret(userId);
	const vaultKey = currentVaultKey ?? Crypto.randomUUID();
	try {
		await hsmPutKey(buildVaultPath(userId, vaultKey), content, secret);
		return { vaultKey, createdSecret: created };
	} catch (error) {
		if (
			error instanceof VaultError &&
			error.kind === "forbidden" &&
			currentVaultKey
		) {
			const freshKey = Crypto.randomUUID();
			await hsmPutKey(buildVaultPath(userId, freshKey), content, secret);
			return { vaultKey: freshKey, createdSecret: created };
		}
		throw error;
	}
}

/**
 * 删除 HSM 条目。404 幂等成功；403/网络失败照常抛——
 * 网络失败时调用方必须中止「移除保险箱」流程，避免远端留着可解密
 * 内容而本地丢了入口。
 */
export async function deleteVaultEntry(
	userId: string,
	vaultKey: string,
): Promise<void> {
	const secret = await requireSecret(userId);
	await hsmDeleteKey(buildVaultPath(userId, vaultKey), secret);
}

/** 读恢复码（= 密钥本体 hex）。仅在生物识别通过后展示。 */
export async function readRecoveryCode(userId: string): Promise<string> {
	return requireSecret(userId);
}

/** 用恢复码导入（覆盖）本机密钥。格式不对抛 invalid_code。 */
export async function importRecoveryCode(
	userId: string,
	code: string,
): Promise<void> {
	if (!isValidRecoveryCode(code)) throw new VaultError("invalid_code");
	await setVaultSecret(userId, normalizeRecoveryCode(code));
}

/** 注销账号时清掉本机密钥条目。HSM 残留密文自此不可解，等同垃圾。 */
export async function destroyLocalVaultSecret(userId: string): Promise<void> {
	await deleteVaultSecret(userId);
}
