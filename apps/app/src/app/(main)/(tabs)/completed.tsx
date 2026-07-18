import { CheckIcon, Trash2Icon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Dimensions,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ErrorBanner } from "@/components/error-banner";
import { FlyingBallLayer, useFlyingBalls } from "@/components/memo/flying-ball";
import { api, type CompletedTask } from "@/lib/api";
import {
	loadCachedCompletedFirstPage,
	replaceCachedCompletedFirstPage,
} from "@/lib/local-db";
import {
	removeTaskEverywhere,
	reopenCompletedTaskLocally,
} from "@/lib/task-sync";
import { useThemeHex } from "@/lib/use-theme-hex";

function formatDay(iso: string | null): string {
	if (!iso) return "更早";
	const d = new Date(iso);
	const now = new Date();
	const sameDay =
		d.getFullYear() === now.getFullYear() &&
		d.getMonth() === now.getMonth() &&
		d.getDate() === now.getDate();
	if (sameDay) return "今天";
	const y = new Date(now);
	y.setDate(now.getDate() - 1);
	if (
		d.getFullYear() === y.getFullYear() &&
		d.getMonth() === y.getMonth() &&
		d.getDate() === y.getDate()
	) {
		return "昨天";
	}
	return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CompletedScreen() {
	const colors = useThemeHex();
	const [tasks, setTasks] = useState<CompletedTask[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const { balls, launchBall, removeBall } = useFlyingBalls();
	const insets = useSafeAreaInsets();

	// 「今天」Tab 是 4 个 Tab 的第 1 个，图标中心 X = 屏宽 × 1/8。
	// Tab Bar 高 82，paddingTop 8，图标尺寸 ~24，所以图标中心约在 tab bar 顶部下方 20。
	const target = useMemo(() => {
		const { width, height } = Dimensions.get("window");
		return { x: width * (1 / 8), y: height - insets.bottom - 82 + 20 };
	}, [insets.bottom]);

	const refresh = useCallback(async () => {
		const cached = await loadCachedCompletedFirstPage();
		if (cached.length) {
			setTasks(cached);
			setLoading(false);
		}
		try {
			const data = await api.tasks.completed();
			setTasks(data.tasks);
			setNextCursor(data.nextCursor);
			setHasMore(data.hasMore);
			await replaceCachedCompletedFirstPage(data.tasks);
			setLoadError(null);
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : "请求失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await refresh();
		} finally {
			setRefreshing(false);
		}
	}, [refresh]);

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore || !nextCursor) return;
		setLoadingMore(true);
		try {
			const data = await api.tasks.completed(nextCursor);
			setTasks((prev) => [...prev, ...data.tasks]);
			setNextCursor(data.nextCursor);
			setHasMore(data.hasMore);
		} finally {
			setLoadingMore(false);
		}
	}, [loadingMore, hasMore, nextCursor]);

	const removeTask = useCallback((id: string) => {
		setTasks((prev) => prev.filter((x) => x.id !== id));
	}, []);

	const restoreTask = useCallback((task: CompletedTask) => {
		setTasks((prev) =>
			prev.some((x) => x.id === task.id) ? prev : [task, ...prev],
		);
	}, []);

	const handleReopen = useCallback(
		async (task: CompletedTask) => {
			await reopenCompletedTaskLocally(task);
			try {
				await api.tasks.reopen(task.id);
			} catch (err) {
				// 失败回滚：重新插回列表 + 提示
				restoreTask(task);
				await replaceCachedCompletedFirstPage([
					task,
					...tasks.filter((x) => x.id !== task.id),
				]);
				if (err instanceof Error) Alert.alert("恢复失败", err.message);
			}
		},
		[restoreTask, tasks],
	);

	const handleDelete = useCallback(
		(t: CompletedTask) => {
			Alert.alert("删除这条完成记录？", `「${t.text}」将被彻底删除。`, [
				{ text: "取消", style: "cancel" },
				{
					text: "删除",
					style: "destructive",
					onPress: async () => {
						const before = tasks;
						setTasks((prev) => prev.filter((x) => x.id !== t.id));
						await removeTaskEverywhere(t.id);
						try {
							await api.tasks.delete(t.id);
						} catch (err) {
							setTasks(before);
							await replaceCachedCompletedFirstPage(before);
							if (err instanceof Error) Alert.alert("删除失败", err.message);
						}
					},
				},
			]);
		},
		[tasks],
	);

	const grouped = useMemo(() => {
		const map = new Map<string, CompletedTask[]>();
		for (const t of tasks) {
			const day = formatDay(t.completedAt);
			const arr = map.get(day) ?? [];
			arr.push(t);
			map.set(day, arr);
		}
		return Array.from(map.entries());
	}, [tasks]);

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
					叨叨记 · 已完成
				</Text>
				<Text className="mt-1 font-serif text-2xl text-ink">
					你搞定的那些事
				</Text>
				<Text className="mt-1 text-ink-soft text-sm">
					已加载 {tasks.length} 件{hasMore ? "（还可加载更多）" : ""}
				</Text>

				{loadError ? (
					<View className="mt-4">
						<ErrorBanner message={loadError} onRetry={refresh} />
					</View>
				) : null}

				{loading ? (
					<View className="mt-12 items-center">
						<ActivityIndicator color={colors.ink} />
					</View>
				) : tasks.length === 0 ? (
					<View className="mt-12 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
						<Text className="font-serif text-ink text-lg">
							还没有完成任何事
						</Text>
						<Text className="mt-1 text-ink-soft text-sm">
							勾掉第一件时会显示在这里。
						</Text>
					</View>
				) : (
					<>
						{grouped.map(([day, list]) => (
							<View key={day} className="mt-5">
								<Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">
									{day} · {list.length}
								</Text>
								<View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
									{list.map((t) => (
										<CompletedRow
											key={t.id}
											task={t}
											onReopen={handleReopen}
											onDelete={handleDelete}
											onRowVanished={removeTask}
											onLaunchBall={launchBall}
										/>
									))}
								</View>
							</View>
						))}

						{hasMore ? (
							<View className="mt-6 items-center">
								<Pressable
									onPress={loadMore}
									disabled={loadingMore}
									className="rounded-full border border-rule px-4 py-2 active:opacity-70"
								>
									{loadingMore ? (
										<ActivityIndicator color={colors.ink} />
									) : (
										<Text className="text-ink-soft text-sm">加载更多</Text>
									)}
								</Pressable>
							</View>
						) : (
							<Text className="mt-6 text-center font-mono text-xs text-ink-mute">
								· 到底了 ·
							</Text>
						)}
					</>
				)}
			</ScrollView>

			<FlyingBallLayer
				balls={balls}
				targetX={target.x}
				targetY={target.y}
				onBallDone={removeBall}
			/>
		</SafeAreaView>
	);
}

interface CompletedRowProps {
	task: CompletedTask;
	onReopen: (task: CompletedTask) => void;
	onDelete: (task: CompletedTask) => void;
	onRowVanished: (id: string) => void;
	onLaunchBall: (x: number, y: number) => void;
}

function CompletedRow({
	task,
	onReopen,
	onDelete,
	onRowVanished,
	onLaunchBall,
}: CompletedRowProps) {
	const colors = useThemeHex();
	const opacity = useSharedValue(1);
	const scale = useSharedValue(1);
	const collapse = useSharedValue(1); // 1 = 原高度, 0 = 折叠
	const naturalHeight = useSharedValue(0);
	const triggered = useRef(false);
	const containerRef = useRef<View>(null);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ scale: scale.value }],
		// onLayout 还没量到时不锁高度；量到后用真实高度 × collapse 平滑塌陷
		height:
			naturalHeight.value > 0
				? naturalHeight.value * collapse.value
				: undefined,
		overflow: "hidden",
	}));

	function vanish() {
		onRowVanished(task.id);
	}

	function handleReopenPress() {
		if (triggered.current) return;
		triggered.current = true;

		// 1) 测量行的左侧（对勾区）作为小球起点
		containerRef.current?.measureInWindow((x, y, _w, h) => {
			const startX = x + 10; // 对勾大致 X（20px 宽，取中心）
			const startY = y + h / 2 - 12; // 行的垂直中点
			onLaunchBall(startX, startY);
		});

		// 2) 行内闪一下 → 折叠 + 透明
		opacity.value = withSequence(
			withTiming(0.45, { duration: 90, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 120, easing: Easing.in(Easing.quad) }),
			withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
		);
		scale.value = withDelay(210, withTiming(0.92, { duration: 220 }));
		collapse.value = withDelay(
			330,
			withTiming(
				0,
				{ duration: 240, easing: Easing.in(Easing.quad) },
				(finished) => {
					if (finished) runOnJS(vanish)();
				},
			),
		);

		// 3) 触发 API（乐观更新；失败由父级回滚）
		onReopen(task);
	}

	return (
		<Animated.View
			ref={containerRef}
			style={animatedStyle}
			onLayout={(e) => {
				if (naturalHeight.value === 0)
					naturalHeight.value = e.nativeEvent.layout.height;
			}}
			className="flex-row items-start gap-3 border-rule/50 border-b py-3 last:border-b-0"
		>
			<Pressable
				onPress={handleReopenPress}
				hitSlop={8}
				className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-accent-good active:opacity-70"
			>
				<CheckIcon size={12} color={colors.paper} />
			</Pressable>
			<View className="min-w-0 flex-1">
				<Text className="text-ink-soft text-base line-through">
					{task.text}
				</Text>
				<Text className="mt-1 font-mono text-ink-mute text-sm">
					{task.tags.length ? `🏷 ${task.tags.join(" ")} · ` : ""}
					{formatTime(task.completedAt)}
				</Text>
			</View>
			<Pressable
				onPress={() => onDelete(task)}
				hitSlop={8}
				className="p-1.5 active:opacity-60"
			>
				<Trash2Icon size={16} color={colors.inkMute} />
			</Pressable>
		</Animated.View>
	);
}
