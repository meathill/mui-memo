import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarIcon } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { hapticSelection } from "@/lib/haptics";
import { useThemeHex } from "@/lib/use-theme-hex";

export function Section({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<View className="mb-6">
			<Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">
				{label}
			</Text>
			{children}
		</View>
	);
}

export function ChipRow<T extends string>({
	options,
	value,
	onChange,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (v: T) => void;
}) {
	return (
		<View className="flex-row flex-wrap gap-2">
			{options.map((o) => {
				const active = o.value === value;
				return (
					<Pressable
						key={o.value}
						onPress={() => {
							hapticSelection();
							onChange(o.value);
						}}
						className={`rounded-full px-4 py-2 ${active ? "bg-ink" : "border border-rule bg-paper-2/50"}`}
					>
						<Text
							className={`text-sm ${active ? "text-paper" : "text-ink-soft"}`}
						>
							{o.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

/**
 * Expect-at 预设：语音 app 的核心理念是「不强制管理时间」，所以这里不上
 * 完整 date picker，给几个常用预设 + 清空，需要精细调时间再靠语音。
 */
function expectPresets(): { label: string; iso: string | null }[] {
	const now = new Date();
	const inAnHour = new Date(now.getTime() + 60 * 60 * 1000);
	const tonight = new Date(now);
	tonight.setHours(20, 0, 0, 0);
	const tomorrow = new Date(now);
	tomorrow.setDate(now.getDate() + 1);
	tomorrow.setHours(9, 0, 0, 0);
	const weekend = new Date(now);
	const daysToSat = (6 - weekend.getDay() + 7) % 7 || 7;
	weekend.setDate(weekend.getDate() + daysToSat);
	weekend.setHours(10, 0, 0, 0);
	// 今晚 / 明早 / 周末 是否已经过了「现在」，过了就不出，免得点完还是过期
	const presets: { label: string; iso: string | null }[] = [
		{ label: "1 小时后", iso: inAnHour.toISOString() },
	];
	if (tonight.getTime() > now.getTime())
		presets.push({ label: "今晚", iso: tonight.toISOString() });
	presets.push(
		{ label: "明早", iso: tomorrow.toISOString() },
		{ label: "周末", iso: weekend.toISOString() },
		{ label: "无", iso: null },
	);
	return presets;
}

/**
 * 预期时间字段：常用预设 chip + 「设置具体时间」唤起原生 date picker。
 * iOS 走自定义底部弹窗（datetime spinner）；Android 走系统两步（先日期后时间）。
 */
export function ExpectAtField({
	value,
	onChange,
}: {
	value: string | null;
	onChange: (iso: string | null) => void;
}) {
	const colors = useThemeHex();
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
	const [tempDate, setTempDate] = useState<Date>(new Date());

	function handleOpenPicker() {
		setTempDate(value ? new Date(value) : new Date());
		setShowDatePicker(true);
	}

	function handleConfirmIOS() {
		onChange(tempDate.toISOString());
		setShowDatePicker(false);
	}

	function handleAndroidDateChange(event: DateTimePickerEvent, date?: Date) {
		setShowDatePicker(false);
		if (event.type === "set" && date) {
			setTempDate(date);
			setTimeout(() => {
				setShowAndroidTimePicker(true);
			}, 100);
		}
	}

	function handleAndroidTimeChange(event: DateTimePickerEvent, date?: Date) {
		setShowAndroidTimePicker(false);
		if (event.type === "set" && date) {
			const finalDate = new Date(tempDate);
			finalDate.setHours(date.getHours());
			finalDate.setMinutes(date.getMinutes());
			finalDate.setSeconds(0);
			finalDate.setMilliseconds(0);
			onChange(finalDate.toISOString());
		}
	}

	return (
		<>
			<View className="flex-row flex-wrap gap-2">
				{expectPresets().map((preset) => {
					const active = value === preset.iso;
					return (
						<Pressable
							key={preset.label}
							onPress={() => {
								hapticSelection();
								onChange(preset.iso);
							}}
							className={`rounded-full px-4 py-2 ${active ? "bg-ink" : "border border-rule bg-paper-2/50"}`}
						>
							<Text
								className={`text-sm ${active ? "text-paper" : "text-ink-soft"}`}
							>
								{preset.label}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<Pressable
				onPress={handleOpenPicker}
				className="mt-3 flex-row items-center gap-1.5 self-start py-1"
				hitSlop={8}
			>
				<CalendarIcon size={14} color={value ? colors.ink : colors.inkMute} />
				<Text
					className={`font-mono text-xs ${value ? "text-ink underline" : "text-ink-mute"}`}
				>
					{value ? new Date(value).toLocaleString() : "设置具体时间..."}
				</Text>
			</Pressable>

			{/* iOS 日期时间选择弹窗 */}
			{Platform.OS === "ios" && showDatePicker && (
				<Modal
					transparent={true}
					animationType="slide"
					visible={showDatePicker}
					onRequestClose={() => {
						setShowDatePicker(false);
					}}
				>
					<View className="flex-1 justify-end bg-black/40">
						<View className="bg-paper rounded-t-2xl pb-8 px-4 pt-4">
							<View className="flex-row justify-between items-center mb-4">
								<Pressable
									onPress={() => {
										setShowDatePicker(false);
									}}
									hitSlop={8}
								>
									<Text className="text-ink-mute text-base">取消</Text>
								</Pressable>
								<Text className="font-serif text-ink text-base font-bold">
									选择时间
								</Text>
								<Pressable onPress={handleConfirmIOS} hitSlop={8}>
									<Text className="text-ink text-base font-bold">确定</Text>
								</Pressable>
							</View>
							<DateTimePicker
								value={tempDate}
								mode="datetime"
								display="spinner"
								onChange={(_event, date) => {
									if (date) setTempDate(date);
								}}
								textColor={colors.ink}
							/>
						</View>
					</View>
				</Modal>
			)}

			{/* Android 日期选择器 */}
			{Platform.OS === "android" && showDatePicker && (
				<DateTimePicker
					value={tempDate}
					mode="date"
					display="default"
					onChange={handleAndroidDateChange}
				/>
			)}

			{/* Android 时间选择器 */}
			{Platform.OS === "android" && showAndroidTimePicker && (
				<DateTimePicker
					value={tempDate}
					mode="time"
					display="default"
					onChange={handleAndroidTimeChange}
				/>
			)}
		</>
	);
}
