import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import {
	CheckIcon,
	ChevronLeftIcon,
	CopyIcon,
	DownloadIcon,
	KeyRoundIcon,
	LockIcon,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	Alert,
	AppState,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hapticSuccess } from "@/lib/haptics";
import { useSession } from "@/lib/session";
import { useThemeHex } from "@/lib/use-theme-hex";
import { importRecoveryCode, readRecoveryCode } from "@/lib/vault";
import { authenticateForVault } from "@/lib/vault-biometric";
import { hasVaultSecret } from "@/lib/vault-keychain";
import {
	formatRecoveryCode,
	isValidRecoveryCode,
	VaultError,
	vaultErrorMessage,
} from "@/lib/vault-model";

const DANGER_RED = "#dc2626";

/**
 * 保险箱设置：状态、查看恢复码（生物识别后临时显示）、恢复码导入。
 * 恢复码 = 保险箱密钥本体，切后台立即收起。
 */
export default function VaultSettingsScreen() {
	const colors = useThemeHex();
	const userId = useSession((s) => s.user?.id ?? null);

	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [importDraft, setImportDraft] = useState("");
	const [importing, setImporting] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!userId) return;
		hasVaultSecret(userId)
			.then(setEnabled)
			.catch(() => setEnabled(null));
	}, [userId]);

	// 恢复码等同密钥本体：切后台立即收起
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "background") setRecoveryCode(null);
		});
		return () => {
			sub.remove();
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		};
	}, []);

	async function handleReveal() {
		if (!userId) return;
		const auth = await authenticateForVault("查看保险箱恢复码");
		if (auth === "unavailable") {
			Alert.alert(
				"无法使用保险箱",
				"设备未设置锁屏密码或生物识别。请先在系统设置中开启。",
			);
			return;
		}
		if (auth !== "ok") return;
		try {
			setRecoveryCode(await readRecoveryCode(userId));
		} catch (error) {
			const message =
				error instanceof VaultError
					? vaultErrorMessage(error.kind)
					: "读取失败";
			Alert.alert("无法读取恢复码", message);
		}
	}

	async function handleCopyCode() {
		if (!recoveryCode) return;
		await Clipboard.setStringAsync(recoveryCode);
		hapticSuccess();
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 2000);
	}

	function handleImport() {
		if (!userId || importing) return;
		if (!isValidRecoveryCode(importDraft)) {
			Alert.alert("恢复码格式不对", vaultErrorMessage("invalid_code"));
			return;
		}
		Alert.alert(
			"用恢复码覆盖本机密钥？",
			"本机现有密钥将被替换。用旧密钥加密的条目将无法读取、修改和删除，除非再改回旧恢复码。",
			[
				{ text: "取消", style: "cancel" },
				{
					text: "覆盖导入",
					style: "destructive",
					onPress: () => void doImport(),
				},
			],
		);
	}

	async function doImport() {
		if (!userId) return;
		const auth = await authenticateForVault("导入保险箱恢复码");
		if (auth !== "ok") return;
		setImporting(true);
		try {
			await importRecoveryCode(userId, importDraft);
			setImportDraft("");
			setEnabled(true);
			setRecoveryCode(null);
			Alert.alert("已导入", "本机密钥已更新，用该密钥加密的内容现在可以解锁。");
		} catch (error) {
			const message =
				error instanceof VaultError
					? vaultErrorMessage(error.kind)
					: "导入失败";
			Alert.alert("导入失败", message);
		} finally {
			setImporting(false);
		}
	}

	return (
		<SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
			<Stack.Screen options={{ headerShown: false }} />
			<View className="flex-row items-center gap-2 px-4 py-3">
				<Pressable
					onPress={() => router.back()}
					hitSlop={8}
					className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
				>
					<ChevronLeftIcon size={22} color={colors.ink} />
				</Pressable>
				<Text className="font-serif text-ink text-lg">任务保险箱</Text>
			</View>

			<ScrollView contentContainerClassName="px-5 pt-2 pb-10">
				{/* 状态卡 */}
				<View className="rounded-2xl border border-rule/60 bg-paper-2/50 p-4">
					<View className="flex-row items-center gap-3">
						<View className="h-10 w-10 items-center justify-center rounded-full bg-ink/10">
							<LockIcon size={18} color={colors.ink} />
						</View>
						<View className="flex-1">
							<Text className="font-serif text-base text-ink">
								{enabled ? "已启用" : "尚未使用"}
							</Text>
							<Text className="mt-0.5 text-ink-soft text-sm">
								{enabled
									? Platform.OS === "ios"
										? "密钥在系统钥匙串 · 随 iCloud 钥匙串同步"
										: "密钥在本机 Keystore · 不跨设备同步"
									: "首次给任务添加保险箱内容时自动生成密钥"}
							</Text>
						</View>
					</View>
					<Text className="mt-3 text-ink-mute text-xs leading-relaxed">
						端到端加密：密文存放在 HSM
						服务，解密密钥只在你的设备上。服务器（包括叨叨记自己）都无法解读内容。
					</Text>
				</View>

				{/* 查看恢复码 */}
				<View className="mt-4 rounded-2xl border border-rule/60 bg-paper-2/50 p-4">
					<View className="flex-row items-center gap-2">
						<KeyRoundIcon size={14} color={colors.inkMute} />
						<Text className="font-mono text-ink-mute text-sm uppercase tracking-[2px]">
							恢复码
						</Text>
					</View>
					<Text className="mt-2 text-ink-soft text-sm">
						恢复码就是保险箱密钥。换设备、关闭 iCloud 钥匙串或使用 Android
						时，凭它找回全部保险箱内容。
					</Text>
					{recoveryCode ? (
						<>
							<Text
								selectable
								className="mt-3 rounded-lg border border-rule bg-paper px-3 py-3 text-center font-mono text-base text-ink leading-relaxed"
							>
								{formatRecoveryCode(recoveryCode)}
							</Text>
							<Text className="mt-2 text-xs" style={{ color: DANGER_RED }}>
								任何人拿到恢复码即可解密你的全部保险箱内容，请抄写到安全的地方。
							</Text>
							<View className="mt-3 flex-row gap-2">
								<Pressable
									onPress={() => void handleCopyCode()}
									className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-rule py-2 active:opacity-70"
								>
									{copied ? (
										<CheckIcon size={14} color={colors.inkMute} />
									) : (
										<CopyIcon size={14} color={colors.inkMute} />
									)}
									<Text className="text-ink-soft text-sm">
										{copied ? "已复制" : "复制"}
									</Text>
								</Pressable>
								<Pressable
									onPress={() => setRecoveryCode(null)}
									className="flex-1 items-center justify-center rounded-xl border border-rule py-2 active:opacity-70"
								>
									<Text className="text-ink-soft text-sm">收起</Text>
								</Pressable>
							</View>
						</>
					) : (
						<Pressable
							onPress={() => void handleReveal()}
							disabled={!enabled}
							className={`mt-3 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
								enabled ? "bg-ink active:opacity-80" : "bg-ink/20"
							}`}
						>
							<KeyRoundIcon size={15} color={colors.paper} />
							<Text className="text-paper text-sm">
								{enabled ? "查看恢复码" : "尚无密钥"}
							</Text>
						</Pressable>
					)}
				</View>

				{/* 恢复码导入 */}
				<View className="mt-4 rounded-2xl border border-rule/60 bg-paper-2/50 p-4">
					<View className="flex-row items-center gap-2">
						<DownloadIcon size={14} color={colors.inkMute} />
						<Text className="font-mono text-ink-mute text-sm uppercase tracking-[2px]">
							用恢复码导入
						</Text>
					</View>
					<Text className="mt-2 text-ink-soft text-sm">
						在新设备上输入以前备份的恢复码，即可解锁旧内容。
					</Text>
					<TextInput
						value={importDraft}
						onChangeText={setImportDraft}
						placeholder="粘贴或输入 64 位恢复码（空格会被忽略）"
						placeholderTextColor={colors.inkMute}
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="off"
						multiline
						className="mt-3 min-h-[72px] rounded-lg border border-rule bg-paper px-3 py-2.5 font-mono text-ink text-sm"
						textAlignVertical="top"
					/>
					<Pressable
						onPress={handleImport}
						disabled={!importDraft.trim() || importing}
						className={`mt-3 items-center justify-center rounded-xl py-2.5 ${
							importDraft.trim() && !importing
								? "bg-ink active:opacity-80"
								: "bg-ink/20"
						}`}
					>
						<Text className="text-paper text-sm">
							{importing ? "导入中…" : "导入"}
						</Text>
					</Pressable>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
