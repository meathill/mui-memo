import type { TaskView } from "@mui-memo/shared/logic";
import Constants, { AppOwnership } from "expo-constants";
import { Platform } from "react-native";
import { buildTodayTasksWidgetSnapshot } from "./today-tasks-widget-model";

export async function syncTodayTasksWidgetSnapshot(
	tasks: TaskView[],
	isSignedIn = true,
): Promise<void> {
	if (!canUseExpoWidgets()) return;

	try {
		const widget = await import("./today-tasks-widget");
		widget.default.updateSnapshot(
			buildTodayTasksWidgetSnapshot({
				isSignedIn,
				tasks,
			}),
		);
	} catch {
		// expo-widgets 不在 Expo Go 可用；widget 同步失败不应影响主流程。
	}
}

function canUseExpoWidgets(): boolean {
	return Platform.OS === "ios" && Constants.appOwnership !== AppOwnership.Expo;
}
