import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import {
	CheckIcon,
	CopyIcon,
	EyeOffIcon,
	LockIcon,
	PencilIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	AppState,
	Pressable,
	Text,
	View,
} from "react-native";
import { hapticSuccess } from "@/lib/haptics";
import { useSession } from "@/lib/session";
import { useThemeHex } from "@/lib/use-theme-hex";
import { unlockVault } from "@/lib/vault";
import { authenticateForVault } from "@/lib/vault-biometric";
import { VaultError, vaultErrorMessage } from "@/lib/vault-model";

/**
 * 任务详情页的保险箱卡片：生物识别解锁 → 明文只进本组件 useState，
 * 离屏（useFocusEffect cleanup）与切后台立即清空。
 */
export function TaskVaultCard({
	taskId,
	vaultKey,
}: {
	taskId: string;
	vaultKey: string;
}) {
	const colors = useThemeHex();
	const userId = useSession((s) => s.user?.id ?? null);
	const [plaintext, setPlaintext] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// 离屏清明文（含跳去编辑屏）
	useFocusEffect(
		useCallback(() => {
			return () => setPlaintext(null);
		}, []),
	);
	// 切后台清明文，app 切换器快照只拍到锁定态
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "background") setPlaintext(null);
		});
		return () => {
			sub.remove();
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		};
	}, []);

	async function handleUnlock() {
		if (!userId || busy) return;
		setBusy(true);
		try {
			const auth = await authenticateForVault("解锁保险箱");
			if (auth === "unavailable") {
				Alert.alert(
					"无法使用保险箱",
					"设备未设置锁屏密码或生物识别。请先在系统设置中开启。",
				);
				return;
			}
			if (auth !== "ok") return;
			setPlaintext(await unlockVault(userId, vaultKey));
		} catch (error) {
			if (error instanceof VaultError && error.kind === "no_secret") {
				Alert.alert("此设备没有保险箱密钥", vaultErrorMessage("no_secret"), [
					{ text: "取消", style: "cancel" },
					{ text: "去导入", onPress: () => router.push("/vault-settings") },
				]);
				return;
			}
			const message =
				error instanceof VaultError
					? vaultErrorMessage(error.kind)
					: error instanceof Error
						? error.message
						: "未知错误";
			Alert.alert("解锁失败", message);
		} finally {
			setBusy(false);
		}
	}

	async function handleCopy() {
		if (plaintext == null) return;
		await Clipboard.setStringAsync(plaintext);
		hapticSuccess();
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 2000);
	}

	return (
		<View className="mt-4 rounded-2xl border border-rule/60 bg-paper-2/40 p-4">
			<View className="flex-row items-center gap-2">
				<LockIcon size={14} color={colors.inkMute} />
				<Text className="font-mono text-ink-mute text-sm uppercase tracking-[2px]">
					保险箱
				</Text>
			</View>

			{plaintext == null ? (
				<>
					<Text className="mt-2 text-ink-soft text-sm">
						内容已端到端加密，解锁后仅在本页临时显示。
					</Text>
					<Pressable
						onPress={() => void handleUnlock()}
						disabled={busy}
						className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-ink py-2.5 active:opacity-80"
					>
						{busy ? (
							<ActivityIndicator size="small" color={colors.paper} />
						) : (
							<LockIcon size={15} color={colors.paper} />
						)}
						<Text className="text-paper text-sm">解锁查看</Text>
					</Pressable>
				</>
			) : (
				<>
					<Text
						selectable
						className="mt-3 font-mono text-ink text-sm leading-relaxed"
					>
						{plaintext}
					</Text>
					<View className="mt-3 flex-row items-center gap-2">
						<Pressable
							onPress={() => void handleCopy()}
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
							onPress={() => router.push(`/tasks/${taskId}/vault`)}
							className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-rule py-2 active:opacity-70"
						>
							<PencilIcon size={14} color={colors.inkMute} />
							<Text className="text-ink-soft text-sm">编辑</Text>
						</Pressable>
						<Pressable
							onPress={() => setPlaintext(null)}
							className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-rule py-2 active:opacity-70"
						>
							<EyeOffIcon size={14} color={colors.inkMute} />
							<Text className="text-ink-soft text-sm">收起</Text>
						</Pressable>
					</View>
				</>
			)}
		</View>
	);
}
