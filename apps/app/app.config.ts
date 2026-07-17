import type { ExpoConfig } from "expo/config";
import pkg from "./package.json" with { type: "json" };

/**
 * 动态配置：支持从环境变量覆盖 API base URL。
 *
 * 优先级：
 *   1. `EXPO_PUBLIC_API_BASE`（local dev 跑本机 web 时在 apps/app/.env.local 里写）
 *   2. 生产部署 URL（默认，绝大多数场景不需要改）
 *
 * 为什么默认走远端：朋友们点模拟器 / 真机就能直接用，不必依赖开发机
 * 把 web 跑起来。本地开发 web 时设一下 .env.local 即可。
 */
const PROD_API_BASE = "https://muimemo.meathill.com";
const apiBase = process.env.EXPO_PUBLIC_API_BASE?.trim() || PROD_API_BASE;

const PROD_FEEDBACK_API_BASE = "https://feedback.meathill.com";
const feedbackApiBase =
	process.env.EXPO_PUBLIC_FEEDBACK_API_BASE?.trim() || PROD_FEEDBACK_API_BASE;

// 类型里还没跟上的字段（比如 newArchEnabled）只能借 as 绕开
const config: ExpoConfig & { newArchEnabled?: boolean } = {
	name: "MuiMemo",
	slug: "mui-memo",
	scheme: "muimemo",
	version: pkg.version,
	orientation: "portrait",
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	icon: "./assets/icon.png",

	ios: {
		supportsTablet: false,
		bundleIdentifier: "com.meathill.muimemo",
		usesAppleSignIn: true,
		infoPlist: {
			// 主屏显示名 = App Store 商店名「叨叨记」。app.config 是 prebuild 的源头，
			// ios/ 是 gitignore 的 prebuild 产物，改这里才不会被重新生成覆盖。
			CFBundleDisplayName: "叨叨记",
			// 开发区域 = 简体中文。不设的话 prebuild 默认落到 en，App Store 商品页
			//「语言」栏会声明成英文（这一栏读的是包里声明的本地化，与 UI 实际语言无关）。
			// 改完需重新 build + submit，商品页那一栏才会随新二进制变成「简体中文」。
			CFBundleDevelopmentRegion: "zh-Hans",
			CFBundleLocalizations: ["zh-Hans"],
			NSMicrophoneUsageDescription: "叨叨记需要使用麦克风来录制你的语音备忘。",
			ITSAppUsesNonExemptEncryption: false,
		},
	},
	plugins: [
		[
			"expo-splash-screen",
			{
				backgroundColor: "#f4ede0",
				resizeMode: "contain",
				image: "./assets/splash.png",
				dark: {
					// 深色模式下用对应的深底色，避免启动一闪刺眼的浅色
					backgroundColor: "#1a1812",
					image: "./assets/splash.png",
				},
			},
		],
		"expo-router",
		[
			"expo-audio",
			{
				microphonePermission: "允许叨叨记使用麦克风录制你的语音备忘。",
			},
		],
		"expo-secure-store",
		[
			"expo-local-authentication",
			{
				faceIDPermission: "允许叨叨记使用 Face ID 解锁任务保险箱。",
			},
		],
		// iOS 不需要 google-services，只用 local notifications，配置最简
		"expo-notifications",
		"expo-apple-authentication",
		"@react-native-community/datetimepicker",
		[
			"expo-widgets",
			{
				bundleIdentifier: "com.meathill.muimemo.widgets",
				groupIdentifier: "group.com.meathill.muimemo",
				enablePushNotifications: false,
				widgets: [
					{
						name: "TodayTasksWidget",
						displayName: "今天任务",
						description: "显示今天最该处理的任务。",
						supportedFamilies: ["systemSmall", "systemMedium"],
					},
				],
			},
		],
	],
	experiments: {
		typedRoutes: false,
	},
	extra: {
		apiBase,
		feedbackApiBase,
		eas: {
			// `eas init` 生成的固定 projectId，别改；重装 / 换机跑 eas build 都靠它认项目
			projectId: "b2890ed6-fdc6-4ec5-898d-9a7c6f7f8504",
		},
	},
};

export default config;
