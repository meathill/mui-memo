/**
 * 保险箱密钥的 Keychain 薄封装（react-native-keychain）。
 *
 * iOS 用 cloudSync: true 让条目随 iCloud 钥匙串跨设备同步。注意：
 * kSecAttrSynchronizable 与条目级生物识别（SecAccessControl）互斥，
 * 生物识别改在 App 层门控（见 vault-biometric.ts）；accessible 必须用
 * 非 THIS_DEVICE_ONLY 变体（默认 AFTER_FIRST_UNLOCK），否则不进同步。
 * Android 无 iCloud 等价物，设备绑定 + 恢复码迁移。
 */

import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as Keychain from "react-native-keychain";
import { buildKeychainService, bytesToHex, VaultError } from "./vault-model";

const KEYCHAIN_USERNAME = "vault-secret";

function baseOptions(userId: string): Keychain.BaseOptions {
	return {
		service: buildKeychainService(userId),
		...(Platform.OS === "ios" ? { cloudSync: true } : {}),
	};
}

/** 读密钥；不存在返回 null。Keychain 本身的异常规整成 keychain 错，
 *  绝不把「读失败」误判为「无密钥」（那会误导用户去导恢复码）。 */
export async function getVaultSecret(userId: string): Promise<string | null> {
	let credentials: false | Keychain.UserCredentials;
	try {
		credentials = await Keychain.getGenericPassword(baseOptions(userId));
	} catch {
		throw new VaultError("keychain");
	}
	return credentials ? credentials.password : null;
}

export async function hasVaultSecret(userId: string): Promise<boolean> {
	try {
		return await Keychain.hasGenericPassword(baseOptions(userId));
	} catch {
		throw new VaultError("keychain");
	}
}

/** 写入/覆盖密钥（恢复码导入也走这里）。 */
export async function setVaultSecret(
	userId: string,
	hexSecret: string,
): Promise<void> {
	let result: Awaited<ReturnType<typeof Keychain.setGenericPassword>>;
	try {
		result = await Keychain.setGenericPassword(KEYCHAIN_USERNAME, hexSecret, {
			...baseOptions(userId),
			accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
		});
	} catch {
		throw new VaultError("keychain");
	}
	if (result === false) throw new VaultError("keychain");
}

/**
 * 确保密钥存在：没有则生成 32 字节随机 hex 并写入。
 * created=true 表示首次生成，调用方据此引导用户备份恢复码。
 */
export async function ensureVaultSecret(
	userId: string,
): Promise<{ secret: string; created: boolean }> {
	const existing = await getVaultSecret(userId);
	if (existing) return { secret: existing, created: false };
	const secret = bytesToHex(await Crypto.getRandomBytesAsync(32));
	await setVaultSecret(userId, secret);
	return { secret, created: true };
}

/** 删除本机（含 iCloud 同步域）的密钥条目。注销账号时用。 */
export async function deleteVaultSecret(userId: string): Promise<void> {
	try {
		await Keychain.resetGenericPassword(baseOptions(userId));
	} catch {
		throw new VaultError("keychain");
	}
}
