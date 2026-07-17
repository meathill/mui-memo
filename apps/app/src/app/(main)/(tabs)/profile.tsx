import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
	BellIcon,
	CheckIcon,
	ChevronDownIcon,
	CircleIcon,
	LockIcon,
	LogOutIcon,
	MessageSquareIcon,
	MoonIcon,
	PaletteIcon,
	SmartphoneIcon,
	SunIcon,
	Trash2Icon,
	ZapIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorBanner } from "@/components/error-banner";
import { api, type ProfileStats } from "@/lib/api";
import { clearLocalCache } from "@/lib/local-db";
import {
	getPermissionStatus,
	type PermStatus,
	requestPermission,
} from "@/lib/notifications";
import { useSession } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";
import { useThemeHex } from "@/lib/use-theme-hex";
import { destroyLocalVaultSecret } from "@/lib/vault";
import { useAppStore } from "@/store";

const THEME_OPTIONS: {
	value: ThemePreference;
	label: string;
	description: string;
}[] = [
	{ value: "paper", label: "浅色", description: "温润纸感" },
	{ value: "night", label: "深色", description: "深夜纸感" },
	{ value: "mono", label: "极简", description: "黑白极简" },
	{ value: "system", label: "跟随系统", description: "跟随手机外观设置" },
];

// 注销按钮的危险红：主题 token 里没有真正的红（accent-warn 是琥珀、mono 下是黑），
// 危险操作固定用红，任何主题下都读得出「危险/不可逆」。
const DANGER_RED = "#dc2626";

function themeIcon(value: ThemePreference, size: number, color: string) {
	if (value === "paper") return <SunIcon size={size} color={color} />;
	if (value === "night") return <MoonIcon size={size} color={color} />;
	if (value === "mono") return <CircleIcon size={size} color={color} />;
	return <SmartphoneIcon size={size} color={color} />;
}

const VERSION_LABEL = (() => {
	const version = Constants.expoConfig?.version ?? "";
	if (!version) return "";
	const buildNumber =
		Platform.OS === "ios"
			? Constants.expoConfig?.ios?.buildNumber
			: Constants.expoConfig?.android?.versionCode != null
				? String(Constants.expoConfig.android.versionCode)
				: undefined;
	return buildNumber ? `v${version} (${buildNumber})` : `v${version}`;
})();

export default function ProfileScreen() {
	const colors = useThemeHex();
	const themePref = useAppStore((s) => s.theme);
	const setTheme = useAppStore((s) => s.setTheme);
	const [themeOpen, setThemeOpen] = useState(false);
	const [data, setData] = useState<ProfileStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [notifPerm, setNotifPerm] = useState<PermStatus>("prompt");
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		getPermissionStatus()
			.then(setNotifPerm)
			.catch(() => undefined);
	}, []);

	const handleNotifTap = useCallback(async () => {
		if (notifPerm === "granted") return;
		if (notifPerm === "blocked") {
			Linking.openSettings();
			return;
		}
		const next = await requestPermission();
		setNotifPerm(next);
		if (next === "blocked") {
			Alert.alert("已被拒绝", "到「设置 → 叨叨记 → 通知」手动打开。");
		}
	}, [notifPerm]);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const d = await api.profile.stats();
			setData(d);
			setLoadError(null);
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : "请求失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const handleLogout = useCallback(() => {
		Alert.alert("退出登录？", "", [
			{ text: "取消", style: "cancel" },
			{
				text: "退出",
				style: "destructive",
				onPress: async () => {
					try {
						await api.auth.signOut();
					} finally {
						await clearLocalCache();
						useAppStore.getState().clearTaskSnapshot();
						router.replace("/login");
					}
				},
			},
		]);
	}, []);

	// 注销账号（Apple 5.1.1(v)）：两步确认防误触，最终确认后调后端永久删除，
	// 成功跳登录页；失败弹错误、保留登录态。
	const handleDeleteAccount = useCallback(() => {
		Alert.alert(
			"注销账号？",
			"这会永久删除你的账号和全部数据：任务、录音、输入记录。删除后无法恢复。",
			[
				{ text: "取消", style: "cancel" },
				{
					text: "继续注销",
					style: "destructive",
					onPress: () => {
						Alert.alert("最后确认", "确定要永久注销账号吗？此操作不可撤销。", [
							{ text: "我再想想", style: "cancel" },
							{
								text: "确认注销",
								style: "destructive",
								onPress: async () => {
									setDeleting(true);
									try {
										await api.account.deleteAccount();
										// 账号没了，本机保险箱密钥一并清掉；HSM 残留密文自此不可解
										const uid = useSession.getState().user?.id;
										if (uid)
											await destroyLocalVaultSecret(uid).catch(() => undefined);
										await clearLocalCache();
										useAppStore.getState().clearTaskSnapshot();
										router.replace("/login");
									} catch (err) {
										setDeleting(false);
										Alert.alert(
											"注销失败",
											err instanceof Error ? err.message : "请稍后再试",
										);
									}
								},
							},
						]);
					},
				},
			],
		);
	}, []);

	const initial = data?.user.name?.charAt(0)?.toUpperCase() ?? "·";

	return (
		<SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
			<ScrollView
				contentContainerClassName="px-5 pt-4 pb-10"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={colors.ink}
					/>
				}
			>
				<Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">
					叨叨记 · 我的
				</Text>
				<Text className="mt-1 font-serif text-2xl text-ink">账号与数据</Text>

				{loadError ? (
					<View className="mt-4">
						<ErrorBanner message={loadError} onRetry={load} />
					</View>
				) : null}

				{/* 账号 + 统计在这里加载。spinner 放在它们的位置（而非页面底部），加载完才显示
            真实内容——避免初始时顶部显示会被误认成真实数据的「0」、spinner 却在别处转。 */}
				{data ? (
					<>
						<View className="mt-6 flex-row items-center gap-4 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
							<View className="h-14 w-14 items-center justify-center rounded-full bg-ink">
								<Text className="font-serif text-paper text-xl">{initial}</Text>
							</View>
							<View className="min-w-0 flex-1">
								<Text className="font-serif text-ink text-lg" numberOfLines={1}>
									{data.user.name}
								</Text>
								<Text
									className="mt-0.5 font-mono text-ink-mute text-sm"
									numberOfLines={1}
								>
									{data.user.email}
								</Text>
							</View>
						</View>

						<View className="mt-5 flex-row flex-wrap gap-3">
							<StatCard label="今日已勾" value={data.stats.doneToday} accent />
							<StatCard label="累计完成" value={data.stats.done} />
							<StatCard label="清单待办" value={data.stats.pending} />
							<StatCard label="正在做" value={data.stats.doing} />
						</View>
					</>
				) : loading ? (
					<View className="mt-10 items-center">
						<ActivityIndicator color={colors.ink} />
					</View>
				) : null}

				<Pressable
					onPress={handleNotifTap}
					disabled={notifPerm === "granted"}
					className="mt-5 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-accent-warm/15">
						<BellIcon size={18} color={colors.accentWarm} />
					</View>
					<View className="flex-1">
						<Text className="font-serif text-base text-ink">到点提醒</Text>
						<Text className="mt-0.5 text-ink-soft text-sm">
							{notifPerm === "granted"
								? "已打开 · 有预期时间的任务到点会弹通知"
								: notifPerm === "blocked"
									? "被系统禁用 · 点这里去设置里打开"
									: "点一下开启，让到点的任务主动提醒你"}
						</Text>
					</View>
					{notifPerm !== "granted" ? (
						<Text className="font-mono text-accent-warm text-sm">
							{notifPerm === "blocked" ? "去设置" : "开启"}
						</Text>
					) : null}
				</Pressable>

				<Pressable
					onPress={() => {
						Alert.alert(
							"Siri 快捷指令",
							[
								"在 iOS「快捷指令」app 里加一个新指令：",
								"",
								"1. 动作选「打开 URL」",
								"2. URL 填：muimemo://",
								"3. 指令名改成「记一下」之类",
								"",
								"然后对 Siri 说「嘿 Siri, 记一下」就会打开叨叨记。",
							].join("\n"),
							[
								{ text: "知道了", style: "cancel" },
								{
									text: "打开快捷指令",
									onPress: () =>
										Linking.openURL("shortcuts://").catch(() =>
											Alert.alert("打不开", "请到主屏找「快捷指令」app"),
										),
								},
							],
						);
					}}
					className="mt-3 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-accent-good/15">
						<ZapIcon size={18} color={colors.accentGood} />
					</View>
					<View className="flex-1">
						<Text className="font-serif text-base text-ink">Siri 快捷指令</Text>
						<Text className="mt-0.5 text-ink-soft text-sm">
							「嘿 Siri, 记一下」一秒打开叨叨记
						</Text>
					</View>
					<Text className="font-mono text-accent-good text-sm">怎么配</Text>
				</Pressable>

				<Pressable
					onPress={() => setThemeOpen((v) => !v)}
					className="mt-3 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-accent-warm/15">
						<PaletteIcon size={18} color={colors.accentWarm} />
					</View>
					<View className="flex-1">
						<Text className="font-serif text-base text-ink">外观</Text>
						<Text className="mt-0.5 text-ink-soft text-sm">
							{THEME_OPTIONS.find((o) => o.value === themePref)?.label ??
								"跟随系统"}{" "}
							·{" "}
							{THEME_OPTIONS.find((o) => o.value === themePref)?.description ??
								""}
						</Text>
					</View>
					<ChevronDownIcon
						size={18}
						color={colors.inkMute}
						style={{ transform: [{ rotate: themeOpen ? "180deg" : "0deg" }] }}
					/>
				</Pressable>

				{themeOpen ? (
					<View className="mt-2 gap-1.5 rounded-2xl border border-rule/60 bg-paper-2/30 p-2">
						{THEME_OPTIONS.map((opt) => {
							const selected = themePref === opt.value;
							return (
								<Pressable
									key={opt.value}
									onPress={() => setTheme(opt.value)}
									className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-70 ${
										selected ? "bg-accent-warm/10" : ""
									}`}
								>
									<View className="h-8 w-8 items-center justify-center rounded-full bg-paper">
										{themeIcon(
											opt.value,
											16,
											selected ? colors.accentWarm : colors.inkSoft,
										)}
									</View>
									<View className="flex-1">
										<Text
											className={`font-serif text-base ${selected ? "text-accent-warm" : "text-ink"}`}
										>
											{opt.label}
										</Text>
										<Text className="mt-0.5 text-ink-mute text-xs">
											{opt.description}
										</Text>
									</View>
									{selected ? (
										<CheckIcon size={18} color={colors.accentWarm} />
									) : null}
								</Pressable>
							);
						})}
					</View>
				) : null}

				<Pressable
					onPress={() => router.push("/vault-settings")}
					className="mt-3 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-ink/10">
						<LockIcon size={18} color={colors.ink} />
					</View>
					<View className="flex-1">
						<Text className="font-serif text-base text-ink">任务保险箱</Text>
						<Text className="mt-0.5 text-ink-soft text-sm">
							端到端加密 · 恢复码备份与导入
						</Text>
					</View>
					<Text className="font-mono text-ink-mute text-sm">→</Text>
				</Pressable>

				<Pressable
					onPress={() => router.push("/feedback")}
					className="mt-3 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
				>
					<View className="h-10 w-10 items-center justify-center rounded-full bg-ink/10">
						<MessageSquareIcon size={18} color={colors.ink} />
					</View>
					<View className="flex-1">
						<Text className="font-serif text-base text-ink">意见反馈</Text>
						<Text className="mt-0.5 text-ink-soft text-sm">
							遇到问题或想要新功能？告诉我们
						</Text>
					</View>
					<Text className="font-mono text-ink-mute text-sm">→</Text>
				</Pressable>

				<Pressable
					onPress={handleLogout}
					className="mt-8 flex-row items-center justify-center gap-2 rounded-xl border border-rule py-3.5 active:opacity-70"
				>
					<LogOutIcon size={18} color={colors.ink} />
					<Text className="text-ink text-base">退出登录</Text>
				</Pressable>

				{/* 注销账号：危险操作，弱化展示（无边框红字），点击走两步确认（Apple 5.1.1(v)） */}
				<Pressable
					onPress={handleDeleteAccount}
					disabled={deleting}
					className="mt-3 flex-row items-center justify-center gap-2 py-3 active:opacity-60"
				>
					{deleting ? (
						<ActivityIndicator color={DANGER_RED} />
					) : (
						<>
							<Trash2Icon size={16} color={DANGER_RED} />
							<Text style={{ color: DANGER_RED }} className="text-sm">
								注销账号
							</Text>
						</>
					)}
				</Pressable>

				{VERSION_LABEL ? (
					<Text className="mt-6 text-center font-mono text-[10px] text-ink-mute tracking-[0.15em]">
						{VERSION_LABEL}
					</Text>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

function StatCard({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: boolean;
}) {
	return (
		<View
			className={`flex-1 basis-[45%] rounded-2xl border p-4 ${
				accent
					? "border-accent-warm/40 bg-accent-warm/10"
					: "border-rule/60 bg-paper-2/50"
			}`}
		>
			<Text className="font-mono text-xs text-ink-mute uppercase tracking-[2px]">
				{label}
			</Text>
			<Text className="mt-1 font-serif text-3xl text-ink">{value}</Text>
		</View>
	);
}
