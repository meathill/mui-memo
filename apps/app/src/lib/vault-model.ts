/**
 * 保险箱纯模型层：常量、路径/编码纯函数、错误类型与文案。
 * 刻意零依赖（不 import 任何 native 模块），保证 Node 环境可单测。
 *
 * 架构约定（零知识）：
 * - 密文存用户自有 HSM（信封加密），mui-memo 服务器只存 vaultKey 指针；
 * - 解密密钥（X-HSM-Secret，32 字节随机 hex）在设备 Keychain，iOS 经 iCloud 同步；
 * - 明文只允许存在于 screen 的 useState 与函数返回值，禁入 zustand persist /
 *   SQLite / 日志 / task.text（该列被 TiDB EMBED_TEXT 自动嵌入）。
 */

/** HSM 服务地址。EXPO_PUBLIC_HSM_BASE 由 Metro 构建期内联，本地联调可覆盖。 */
export const HSM_BASE =
	process.env.EXPO_PUBLIC_HSM_BASE?.trim().replace(/\/$/, "") ||
	"https://hsm.meathill.com";

/** 保险箱内容上限。HSM 单值上限 8192 字符，留出余量。 */
export const VAULT_MAX_CHARS = 8000;

/** HSM 存储路径：mui-memo/{userId}/{vaultKey}。逐段 encode，保留分隔斜杠。 */
export function buildVaultPath(userId: string, vaultKey: string): string {
	return ["mui-memo", userId, vaultKey]
		.map((seg) => encodeURIComponent(seg))
		.join("/");
}

/** Keychain service 名：按账号区分，同一设备多账号互不串用。 */
export function buildKeychainService(userId: string): string {
	return `com.meathill.muimemo.vault.${userId}`;
}

export function bytesToHex(bytes: Uint8Array): string {
	let out = "";
	for (const b of bytes) {
		out += b.toString(16).padStart(2, "0");
	}
	return out;
}

/** 恢复码容错归一：去所有空白（用户可能按 4 位分组抄写）、转小写。 */
export function normalizeRecoveryCode(input: string): string {
	return input.replace(/\s+/g, "").toLowerCase();
}

/** 恢复码 = 32 字节 hex，共 64 位十六进制字符。 */
export function isValidRecoveryCode(input: string): boolean {
	return /^[0-9a-f]{64}$/.test(normalizeRecoveryCode(input));
}

/** 展示用：每 8 位一组，便于人工抄写核对。 */
export function formatRecoveryCode(code: string): string {
	return normalizeRecoveryCode(code).replace(/(.{8})(?=.)/g, "$1 ");
}

export type VaultErrorKind =
	| "not_found"
	| "forbidden"
	| "network"
	| "server"
	| "no_secret"
	| "keychain"
	| "invalid_code";

export class VaultError extends Error {
	constructor(
		public kind: VaultErrorKind,
		message?: string,
		public status?: number,
	) {
		super(message ?? kind);
		this.name = "VaultError";
	}
}

/** 错误 → 用户文案。与错误处理矩阵一一对应，UI 层直接取用。 */
export function vaultErrorMessage(kind: VaultErrorKind): string {
	switch (kind) {
		case "not_found":
			return "内容不存在，可能已在其他设备删除";
		case "forbidden":
			return "本机密钥与写入时使用的不一致，请在保险箱设置中换回正确的恢复码";
		case "network":
			return "网络异常，请稍后再试";
		case "server":
			return "保险箱服务暂时不可用，请稍后再试";
		case "no_secret":
			return "此设备没有保险箱密钥，请在保险箱设置中用恢复码导入";
		case "keychain":
			return "读取保险箱密钥失败，请重试";
		case "invalid_code":
			return "恢复码格式不对：应为 64 位十六进制字符";
	}
}
