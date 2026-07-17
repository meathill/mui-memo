import type { TaskView } from "@mui-memo/shared/logic";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { CheckIcon, LockIcon, XIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	AppState,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { loadCachedTaskDetail } from "@/lib/local-db";
import { useSession } from "@/lib/session";
import { patchTaskEverywhere } from "@/lib/task-sync";
import { useThemeHex } from "@/lib/use-theme-hex";
import { deleteVaultEntry, saveVault, unlockVault } from "@/lib/vault";
import { authenticateForVault } from "@/lib/vault-biometric";
import {
	VAULT_MAX_CHARS,
	VaultError,
	vaultErrorMessage,
} from "@/lib/vault-model";
import { useAppStore } from "@/store";

type Phase = "auth" | "loading" | "ready" | "locked";

/**
 * 任务保险箱编辑屏。明文只活在本屏 useState：切后台立即上锁（app
 * 切换器快照只会拍到锁定态），不落任何持久层。
 */
export default function TaskVaultScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const colors = useThemeHex();
	const userId = useSession((s) => s.user?.id ?? null);

	const [phase, setPhase] = useState<Phase>("auth");
	const [task, setTask] = useState<TaskView | null>(null);
	const [content, setContent] = useState("");
	const [saving, setSaving] = useState(false);
	// 镜像最新草稿与 phase，供 AppState 回调同步读取
	const contentRef = useRef("");
	const phaseRef = useRef<Phase>("auth");
	phaseRef.current = phase;
	// 上锁时把明文挪出渲染树，解锁再放回来
	const hiddenDraft = useRef("");

	function updateContent(next: string) {
		contentRef.current = next;
		setContent(next);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleLoadError 每次渲染重建，收敛到 id/userId 即可
	const load = useCallback(async () => {
		if (!id || !userId) return;
		setPhase("auth");
		const auth = await authenticateForVault("解锁任务保险箱");
		if (auth === "unavailable") {
			Alert.alert(
				"无法使用保险箱",
				"设备未设置锁屏密码或生物识别。请先在系统设置中开启，再来使用保险箱。",
				[{ text: "知道了", onPress: () => router.back() }],
			);
			return;
		}
		if (auth === "cancelled") {
			router.back();
			return;
		}
		setPhase("loading");
		try {
			const resolved =
				useAppStore.getState().tasks.find((t) => t.id === id) ??
				(await loadCachedTaskDetail(id))?.task ??
				(await api.tasks.detail(id)).task;
			setTask(resolved);
			if (resolved.vaultKey) {
				updateContent(await unlockVault(userId, resolved.vaultKey));
			}
			setPhase("ready");
		} catch (error) {
			handleLoadError(error);
		}
	}, [id, userId]);

	function handleLoadError(error: unknown) {
		if (error instanceof VaultError && error.kind === "no_secret") {
			Alert.alert("此设备没有保险箱密钥", vaultErrorMessage("no_secret"), [
				{ text: "返回", style: "cancel", onPress: () => router.back() },
				{
					text: "去导入",
					onPress: () => {
						router.back();
						router.push("/vault-settings");
					},
				},
			]);
			return;
		}
		if (error instanceof VaultError && error.kind === "not_found") {
			Alert.alert(
				"内容不存在",
				"可能已在其他设备删除。要移除此任务上的保险箱标记吗？",
				[
					{ text: "返回", style: "cancel", onPress: () => router.back() },
					{
						text: "移除标记",
						style: "destructive",
						onPress: () => void clearPointerAndClose(),
					},
				],
			);
			return;
		}
		const message =
			error instanceof VaultError
				? vaultErrorMessage(error.kind)
				: error instanceof Error
					? error.message
					: "未知错误";
		Alert.alert("打开保险箱失败", message, [
			{ text: "返回", style: "cancel", onPress: () => router.back() },
			{ text: "重试", onPress: () => void load() },
		]);
	}

	useEffect(() => {
		void load();
	}, [load]);

	// 切后台上锁：明文移出渲染树（app 切换器快照只拍到锁定态），
	// 草稿留在内存，回前台重新过生物识别后继续编辑。
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只挂载一次，回调经 ref 读最新状态
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state !== "background" || phaseRef.current !== "ready") return;
			hiddenDraft.current = contentRef.current;
			updateContent("");
			setPhase("locked");
		});
		return () => sub.remove();
	}, []);

	async function handleUnlockAgain() {
		const auth = await authenticateForVault("解锁任务保险箱");
		if (auth !== "ok") return;
		updateContent(hiddenDraft.current);
		hiddenDraft.current = "";
		setPhase("ready");
	}

	/** PATCH 指针并同步本地；失败可重试（内容已安全在 HSM，屏不关）。 */
	async function persistPointer(vaultKey: string | null): Promise<boolean> {
		if (!task) return false;
		try {
			await api.tasks.patch(task.id, { vaultKey });
			await patchTaskEverywhere(task.id, { vaultKey });
			return true;
		} catch {
			return new Promise((resolve) => {
				Alert.alert(
					"内容已加密保存，但任务标记失败",
					"稍后可重试；标记成功前，其它设备看不到这条保险箱。",
					[
						{
							text: "留在本页",
							style: "cancel",
							onPress: () => resolve(false),
						},
						{
							text: "重试",
							onPress: () => void persistPointer(vaultKey).then(resolve),
						},
					],
				);
			});
		}
	}

	async function clearPointerAndClose() {
		const done = await persistPointer(null);
		if (done) router.back();
	}

	async function handleSave() {
		if (!task || !userId || saving) return;
		const trimmed = content.trim();
		if (!trimmed) {
			if (task.vaultKey) {
				Alert.alert("内容为空", "要删除保险箱内容请用下方「移除」按钮。");
			} else {
				router.back();
			}
			return;
		}
		setSaving(true);
		try {
			const { vaultKey, createdSecret } = await saveVault(
				userId,
				task.vaultKey ?? null,
				trimmed,
			);
			if (vaultKey !== task.vaultKey) {
				const done = await persistPointer(vaultKey);
				if (!done) return;
			}
			if (createdSecret) {
				Alert.alert(
					"保险箱密钥已生成",
					"密钥保存在系统钥匙串（iOS 随 iCloud 同步）。建议现在备份恢复码，以防更换设备或关闭 iCloud 钥匙串后无法解密。",
					[
						{ text: "稍后", style: "cancel", onPress: () => router.back() },
						{
							text: "去备份",
							onPress: () => {
								router.back();
								router.push("/vault-settings");
							},
						},
					],
				);
				return;
			}
			router.back();
		} catch (error) {
			const message =
				error instanceof VaultError
					? vaultErrorMessage(error.kind)
					: error instanceof Error
						? error.message
						: "未知错误";
			Alert.alert("保存失败", message);
		} finally {
			setSaving(false);
		}
	}

	function handleRemove() {
		if (!task?.vaultKey || !userId) return;
		Alert.alert("移除保险箱内容", "远端加密内容将被删除，且无法恢复。", [
			{ text: "取消", style: "cancel" },
			{
				text: "移除",
				style: "destructive",
				onPress: () => void doRemove(),
			},
		]);
	}

	async function doRemove() {
		if (!task?.vaultKey || !userId) return;
		try {
			await deleteVaultEntry(userId, task.vaultKey);
		} catch (error) {
			const kind = error instanceof VaultError ? error.kind : null;
			if (kind === "forbidden" || kind === "no_secret") {
				// 删不掉远端条目（密钥不符/缺失）。允许只清标记，但把后果说清楚。
				Alert.alert(
					"无法删除远端内容",
					`${vaultErrorMessage(kind)}。仍要移除任务上的标记吗？远端条目会保留（对当前密钥不可读）。`,
					[
						{ text: "取消", style: "cancel" },
						{
							text: "仍然移除标记",
							style: "destructive",
							onPress: () => void clearPointerAndClose(),
						},
					],
				);
				return;
			}
			// 网络/服务异常必须中止：不能远端留着可解密内容而本地丢了入口
			Alert.alert(
				"移除失败",
				kind ? vaultErrorMessage(kind) : "未知错误，请稍后再试。",
			);
			return;
		}
		await clearPointerAndClose();
	}

	const busy = phase === "auth" || phase === "loading";

	return (
		<SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
			<Stack.Screen options={{ headerShown: false }} />
			<View className="flex-row items-center justify-between border-rule/50 border-b px-4 py-3">
				<Pressable
					onPress={() => router.back()}
					hitSlop={8}
					className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
				>
					<XIcon size={22} color={colors.ink} />
				</Pressable>
				<Text className="font-serif text-ink text-lg">保险箱</Text>
				<Pressable
					onPress={() => void handleSave()}
					disabled={phase !== "ready" || saving}
					hitSlop={8}
					className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
				>
					{saving ? (
						<ActivityIndicator color={colors.ink} />
					) : (
						<CheckIcon size={22} color={colors.ink} />
					)}
				</Pressable>
			</View>

			{busy ? (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={colors.ink} />
				</View>
			) : phase === "locked" ? (
				<View className="flex-1 items-center justify-center gap-4 px-8">
					<LockIcon size={32} color={colors.inkMute} />
					<Text className="text-center text-ink-soft">
						已自动上锁。解锁后继续编辑。
					</Text>
					<Pressable
						onPress={() => void handleUnlockAgain()}
						className="rounded-full bg-ink px-6 py-3 active:opacity-80"
					>
						<Text className="text-paper">解锁</Text>
					</Pressable>
				</View>
			) : (
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					className="flex-1"
				>
					<ScrollView
						contentContainerClassName="px-5 pt-5 pb-10"
						keyboardShouldPersistTaps="handled"
					>
						<Text className="mb-2 text-ink-mute text-xs">
							内容端到端加密：密文存 HSM，密钥在你的设备钥匙串，服务器无法解读。
						</Text>
						<TextInput
							value={content}
							onChangeText={updateContent}
							multiline
							maxLength={VAULT_MAX_CHARS}
							autoCorrect={false}
							autoCapitalize="none"
							autoComplete="off"
							placeholder={
								"API key、密码、口令……\n只有这台设备（和你的恢复码）能解开。"
							}
							placeholderTextColor={colors.inkMute}
							className="min-h-[220px] rounded-lg border border-rule bg-paper-2/50 px-4 py-3 font-mono text-base text-ink"
							textAlignVertical="top"
						/>
						<Text
							className={`mt-1 text-right text-xs ${
								content.length > VAULT_MAX_CHARS - 200
									? "text-accent-warm"
									: "text-ink-mute"
							}`}
						>
							{content.length}/{VAULT_MAX_CHARS}
						</Text>

						{task?.vaultKey ? (
							<Pressable
								onPress={handleRemove}
								className="mt-8 items-center py-3 active:opacity-70"
							>
								<Text className="text-sm" style={{ color: "#dc2626" }}>
									移除保险箱内容
								</Text>
							</Pressable>
						) : null}
					</ScrollView>
				</KeyboardAvoidingView>
			)}
		</SafeAreaView>
	);
}
