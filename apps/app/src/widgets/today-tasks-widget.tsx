import { HStack, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
	background,
	containerBackground,
	cornerRadius,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { TodayTasksWidgetProps } from "./today-tasks-widget-model";

function TodayTasksWidgetView(
	props: TodayTasksWidgetProps,
	environment: WidgetEnvironment,
) {
	"widget";

	const paper = "#f4ede0";
	const ink = "#1d1a12";
	const inkSoft = "#4a4536";
	const inkMute = "#7a7266";
	const accentWarm = "#c17a3a";
	const accentGood = "#4a9670";
	const rule = "#d9d0bd";
	const isSmall = environment.widgetFamily === "systemSmall";
	const headline =
		props.state === "signed-out"
			? "登录后查看今天任务"
			: props.state === "empty"
				? "今天清爽"
				: "今天任务";
	const subtitle =
		props.state === "signed-out"
			? "点开叨叨记登录"
			: props.state === "empty"
				? "没有待处理事项"
				: `${props.counts.total} 件待处理`;

	return (
		<VStack
			alignment="leading"
			spacing={isSmall ? 8 : 10}
			modifiers={[
				containerBackground(paper, "widget"),
				padding({ all: isSmall ? 14 : 16 }),
				widgetURL("muimemo://"),
			]}
		>
			<HStack alignment="center" spacing={8}>
				<VStack alignment="leading" spacing={2}>
					<Text
						modifiers={[
							font({ size: 11, weight: "semibold", design: "monospaced" }),
							foregroundStyle(inkMute),
						]}
					>
						叨叨记
					</Text>
					<Text
						modifiers={[
							font({
								size: isSmall ? 18 : 20,
								weight: "bold",
								design: "serif",
							}),
							foregroundStyle(ink),
						]}
					>
						{headline}
					</Text>
				</VStack>
				<Spacer minLength={4} />
				{props.state === "ready" ? (
					<ZStack
						modifiers={[
							frame({ width: 34, height: 34 }),
							foregroundStyle(paper),
							background(accentWarm),
							cornerRadius(17),
						]}
					>
						<Text
							modifiers={[
								font({ size: 15, weight: "bold", design: "monospaced" }),
							]}
						>
							{props.counts.total}
						</Text>
					</ZStack>
				) : null}
			</HStack>

			{props.state === "ready" ? (
				isSmall ? (
					<VStack alignment="leading" spacing={6}>
						<Text
							modifiers={[
								font({ size: 13, weight: "semibold" }),
								foregroundStyle(inkSoft),
								lineLimit(2),
							]}
						>
							{props.tasks[0]?.text ?? subtitle}
						</Text>
						<Text
							modifiers={[
								font({ size: 11, weight: "medium" }),
								foregroundStyle(inkMute),
							]}
						>
							{subtitle}
						</Text>
					</VStack>
				) : (
					<VStack alignment="leading" spacing={7}>
						{props.tasks.map((task) => {
							const bucketLabel =
								task.bucket === "doing"
									? "正在做"
									: task.bucket === "now"
										? "此刻"
										: task.bucket === "today_here"
											? "今天"
											: "不急";
							const dotColor =
								task.bucket === "doing"
									? accentGood
									: task.bucket === "now"
										? accentWarm
										: rule;
							return (
								<HStack key={task.id} alignment="center" spacing={8}>
									<ZStack
										modifiers={[
											frame({ width: 8, height: 8 }),
											background(dotColor),
											cornerRadius(4),
										]}
									>
										<Spacer minLength={0} />
									</ZStack>
									<Text
										modifiers={[
											font({ size: 13, weight: "medium" }),
											foregroundStyle(ink),
											lineLimit(1),
										]}
									>
										{task.text}
									</Text>
									<Spacer minLength={2} />
									<Text
										modifiers={[
											font({ size: 10, weight: "medium" }),
											foregroundStyle(inkMute),
										]}
									>
										{bucketLabel}
									</Text>
								</HStack>
							);
						})}
					</VStack>
				)
			) : (
				<VStack alignment="leading" spacing={4}>
					<Text
						modifiers={[
							font({ size: 13, weight: "medium" }),
							foregroundStyle(inkSoft),
							lineLimit(2),
						]}
					>
						{subtitle}
					</Text>
					<Text
						modifiers={[
							font({ size: 11, weight: "medium" }),
							foregroundStyle(inkMute),
						]}
					>
						点一下打开应用
					</Text>
				</VStack>
			)}

			<Spacer minLength={0} />
			<Text
				modifiers={[
					font({ size: 10, weight: "medium", design: "monospaced" }),
					foregroundStyle(inkMute),
				]}
			>
				{props.updatedAt ? "已同步" : "等待同步"}
			</Text>
		</VStack>
	);
}

const TodayTasksWidget = createWidget<TodayTasksWidgetProps>(
	"TodayTasksWidget",
	TodayTasksWidgetView,
);

export default TodayTasksWidget;
