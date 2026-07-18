import { CheckIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useThemeHex } from "@/lib/use-theme-hex";

interface FlyingBallItem {
	key: number;
	startX: number;
	startY: number;
}

/**
 * 管理一组「完成 / 恢复」反馈用的飞球动画：谁触发、往哪飞、飞完自动清理。
 * today / all / completed 三个列表页共用，方向由调用方传入的 targetX/targetY 决定。
 */
export function useFlyingBalls() {
	const [balls, setBalls] = useState<FlyingBallItem[]>([]);
	const keyRef = useRef(0);

	const launchBall = useCallback((startX: number, startY: number) => {
		const key = ++keyRef.current;
		setBalls((prev) => [...prev, { key, startX, startY }]);
	}, []);

	const removeBall = useCallback((key: number) => {
		setBalls((prev) => prev.filter((b) => b.key !== key));
	}, []);

	return { balls, launchBall, removeBall };
}

interface FlyingBallProps {
	startX: number;
	startY: number;
	targetX: number;
	targetY: number;
	onDone: () => void;
}

function FlyingBall({
	startX,
	startY,
	targetX,
	targetY,
	onDone,
}: FlyingBallProps) {
	const colors = useThemeHex();
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withTiming(
			1,
			{ duration: 620, easing: Easing.bezier(0.42, 0, 0.2, 1) },
			(finished) => {
				if (finished) runOnJS(onDone)();
			},
		);
	}, [progress, onDone]);

	const style = useAnimatedStyle(() => {
		const p = progress.value;
		const x = startX + (targetX - startX) * p;
		// 用一个轻微抛物线让飞行更自然：中段往上抬一点
		const arc = -40 * Math.sin(Math.PI * p);
		const y = startY + (targetY - startY) * p + arc;
		const scale = 1 - 0.4 * p; // 1 → 0.6
		const opacity = 1 - Math.max(0, (p - 0.7) / 0.3) * 0.7; // 末段轻微淡出
		return {
			transform: [{ translateX: x }, { translateY: y }, { scale }],
			opacity,
		};
	});

	return (
		<Animated.View
			pointerEvents="none"
			style={[{ position: "absolute", left: 0, top: 0 }, style]}
			className="h-6 w-6 items-center justify-center rounded-full bg-accent-good"
		>
			<CheckIcon size={14} color={colors.paper} />
		</Animated.View>
	);
}

interface FlyingBallLayerProps {
	balls: FlyingBallItem[];
	targetX: number;
	targetY: number;
	onBallDone: (key: number) => void;
}

/** 把 useFlyingBalls 的 balls 数组渲染成实际动画，页面里只需铺一层这个。 */
export function FlyingBallLayer({
	balls,
	targetX,
	targetY,
	onBallDone,
}: FlyingBallLayerProps) {
	return (
		<>
			{balls.map((b) => (
				<FlyingBall
					key={b.key}
					startX={b.startX}
					startY={b.startY}
					targetX={targetX}
					targetY={targetY}
					onDone={() => onBallDone(b.key)}
				/>
			))}
		</>
	);
}
