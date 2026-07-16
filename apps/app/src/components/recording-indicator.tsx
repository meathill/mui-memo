import { MicIcon } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store";

/**
 * 全局录音指示条。挂在根 layout，读全局 `isRecording`，录音时在屏幕最顶部
 * （状态栏下方）常驻一条红色条 + 脉冲圆点 + 「正在录音…」。
 *
 * 为什么固定红 + 白字、不走主题 token：录音指示要在任何主题下都一眼可辨，
 * 而 `accent-warn` 在 mono 主题会塌成黑色、读不出「录音中」。Apple 2.5.14
 * 要求指示明显、不可关闭、跨页面常驻——固定红是通用语义，最稳。
 */
const RECORDING_RED = "#ff3b30";

export function RecordingIndicator() {
	const isRecording = useAppStore((s) => s.isRecording);
	const insets = useSafeAreaInsets();
	const pulse = useSharedValue(1);

	useEffect(() => {
		if (isRecording) {
			// 0.35 ↔ 1 来回呼吸，-1 表示无限循环，第三个参数 true 表示往返
			pulse.value = withRepeat(withTiming(0.35, { duration: 600 }), -1, true);
		} else {
			cancelAnimation(pulse);
			pulse.value = 1;
		}
	}, [isRecording, pulse]);

	const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	if (!isRecording) return null;

	return (
		// pointerEvents none：指示条只做展示，不拦截下方任何触摸（按住录音的手指在底部）
		<View
			pointerEvents="none"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				paddingTop: insets.top,
				zIndex: 9999,
				elevation: 9999,
			}}
		>
			<View
				style={{ backgroundColor: RECORDING_RED }}
				className="flex-row items-center justify-center gap-2 py-1.5"
			>
				<Animated.View
					style={[
						dotStyle,
						{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#fff" },
					]}
				/>
				<MicIcon size={13} color="#fff" />
				<Text
					style={{ color: "#fff" }}
					className="font-mono text-xs tracking-[1px]"
				>
					正在录音…
				</Text>
			</View>
		</View>
	);
}
