"use client";

import { useEffect } from "react";
import { initConsentFromStorage } from "@/lib/analytics";

/** 客户端挂载后按存量选择更新 Consent Mode（默认 granted，见 layout 内联脚本）。 */
export function AnalyticsConsent() {
	useEffect(() => {
		initConsentFromStorage();
	}, []);
	return null;
}
