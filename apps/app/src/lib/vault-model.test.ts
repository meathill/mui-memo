import { describe, expect, it } from "vitest";
import {
	buildKeychainService,
	buildVaultPath,
	bytesToHex,
	formatRecoveryCode,
	isValidRecoveryCode,
	normalizeRecoveryCode,
	VAULT_MAX_CHARS,
	vaultErrorMessage,
} from "./vault-model";

const HEX_64 = "a".repeat(64);

describe("buildVaultPath", () => {
	it("按 mui-memo/{userId}/{vaultKey} 拼接", () => {
		expect(buildVaultPath("u1", "k1")).toBe("mui-memo/u1/k1");
	});

	it("逐段 encode，段内特殊字符不会破坏路径结构", () => {
		expect(buildVaultPath("u/1", "k#1")).toBe("mui-memo/u%2F1/k%231");
	});
});

describe("buildKeychainService", () => {
	it("按账号区分 service", () => {
		expect(buildKeychainService("u1")).toBe("com.meathill.muimemo.vault.u1");
		expect(buildKeychainService("u1")).not.toBe(buildKeychainService("u2"));
	});
});

describe("bytesToHex", () => {
	it("补零小写，32 字节输出 64 位", () => {
		expect(bytesToHex(new Uint8Array([0, 1, 255, 16]))).toBe("0001ff10");
		expect(bytesToHex(new Uint8Array(32).fill(171))).toBe("ab".repeat(32));
		expect(bytesToHex(new Uint8Array(32))).toHaveLength(64);
	});
});

describe("恢复码归一与校验", () => {
	it("容错大小写、空格、换行（用户分组抄写的形态）", () => {
		const grouped = `${"ABCD1234".repeat(4)}\n ${"abcd1234".repeat(4)} `;
		expect(normalizeRecoveryCode(grouped)).toBe("abcd1234".repeat(8));
		expect(isValidRecoveryCode(grouped)).toBe(true);
	});

	it("63/65 位、非 hex 字符一律拒绝", () => {
		expect(isValidRecoveryCode(HEX_64.slice(1))).toBe(false);
		expect(isValidRecoveryCode(`${HEX_64}a`)).toBe(false);
		expect(isValidRecoveryCode(`${HEX_64.slice(1)}g`)).toBe(false);
		expect(isValidRecoveryCode("")).toBe(false);
	});

	it("formatRecoveryCode 每 8 位一组，可逆", () => {
		const formatted = formatRecoveryCode(HEX_64);
		expect(formatted.split(" ")).toHaveLength(8);
		expect(normalizeRecoveryCode(formatted)).toBe(HEX_64);
	});
});

describe("vaultErrorMessage", () => {
	it("每种错误码都有非空中文文案", () => {
		const kinds = [
			"not_found",
			"forbidden",
			"network",
			"server",
			"no_secret",
			"keychain",
			"invalid_code",
		] as const;
		for (const kind of kinds) {
			expect(vaultErrorMessage(kind).length).toBeGreaterThan(3);
		}
	});
});

describe("VAULT_MAX_CHARS", () => {
	it("低于 HSM 单值 8192 上限", () => {
		expect(VAULT_MAX_CHARS).toBeLessThan(8192);
	});
});
