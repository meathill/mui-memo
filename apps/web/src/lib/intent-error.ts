interface ErrorDetails {
	name: string;
	message: string;
	stack?: string;
	status?: number;
	code?: string;
	type?: string;
	param?: string;
	requestID?: string;
	cause?: ErrorDetails;
}

interface FailureContext {
	userId: string;
	country: string | null;
	provider: "openai" | "gemini";
	model?: string;
	endpoint?: string;
	audioMimeType: string;
	audioBytes: number;
	rayId: string | null;
}

function redactText(text: string, privateValues: readonly string[]): string {
	let result = text;
	for (const value of privateValues) {
		if (!value) continue;
		result = result.replaceAll(value, "[REDACTED]");
		const escaped = JSON.stringify(value).slice(1, -1);
		if (escaped !== value) result = result.replaceAll(escaped, "[REDACTED]");
	}
	// SDK 在缺少 error.message 时会把整个响应 body 放进 message，仍只保留诊断字段。
	const start = result.indexOf("{");
	const end = result.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			const body: unknown = JSON.parse(result.slice(start, end + 1));
			if (typeof body === "object" && body !== null) {
				const fields = body as Record<string, unknown>;
				const diagnostics = Object.fromEntries(
					["message", "code", "type", "param"].flatMap((key) =>
						typeof fields[key] === "string" ? [[key, fields[key]]] : [],
					),
				);
				result = `${result.slice(0, start)}${JSON.stringify(diagnostics)}${result.slice(end + 1)}`;
			}
		} catch {
			// 普通文本错误仍保留原意。
		}
	}
	return result
		.replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [REDACTED]")
		.replace(/(Authorization\s*[:=]\s*)[^\r\n,;]+/gi, "$1[REDACTED]")
		.replace(/([?&](?:key|api_key|token)=)[^&\s"']+/gi, "$1[REDACTED]")
		.replace(/data:audio\/[^\s"']+/gi, "[REDACTED_AUDIO]")
		.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[REDACTED_DATA]")
		.slice(0, 4096);
}

function serializeError(
	error: unknown,
	privateValues: readonly string[],
	seen = new Set<object>(),
): ErrorDetails {
	if (typeof error !== "object" || error === null) {
		return {
			name: "UnknownError",
			message:
				typeof error === "string"
					? redactText(error, privateValues)
					: "unknown",
		};
	}
	if (seen.has(error) || seen.size >= 4) {
		return { name: "Error", message: "cause 链已截断" };
	}
	seen.add(error);
	const source = error as Record<string, unknown>;
	const name =
		typeof source.name === "string" && source.name !== "Error"
			? source.name
			: error instanceof Error
				? error.constructor.name
				: "Error";
	let message = typeof source.message === "string" ? source.message : "unknown";
	// JSON/Zod 的异常消息可能包含模型完整回答或用户原话，只保留错误类别。
	if (name === "SyntaxError") {
		const position = message.match(
			/(?:at position \d+(?: \(line \d+ column \d+\))?|at line \d+ column \d+)/,
		)?.[0];
		message = `AI 响应 JSON 解析失败${position ? ` (${position})` : ""}`;
	}
	if (name === "ZodError") message = "AI 响应结构校验失败";
	const details: ErrorDetails = {
		name,
		message: redactText(message, privateValues),
	};
	if (typeof source.stack === "string") {
		const frames = source.stack
			.split("\n")
			.filter((line) => /^\s+at\s/.test(line));
		details.stack = redactText(
			`${name}: ${details.message}\n${frames.join("\n")}`,
			privateValues,
		);
	}
	if (typeof source.status === "number" && Number.isFinite(source.status))
		details.status = source.status;
	for (const field of ["code", "type", "param", "requestID"] as const) {
		if (typeof source[field] === "string")
			details[field] = redactText(source[field], privateValues);
	}
	if (source.cause !== undefined)
		details.cause = serializeError(source.cause, privateValues, seen);
	return details;
}

function sanitizeEndpoint(endpoint?: string): string | undefined {
	if (!endpoint) return undefined;
	try {
		const url = new URL(endpoint);
		return `${url.origin}${url.pathname}`;
	} catch {
		return "invalid endpoint";
	}
}

export function logIntentFailure(
	error: unknown,
	context: FailureContext,
	privateValues: readonly string[] = [],
): void {
	// 不展开 Error/SDK 响应对象，避免 headers、request、response 和原始 body 入日志。
	console.error(
		JSON.stringify({
			message: "[api/intent] ai_failed",
			userId: context.userId,
			country: context.country,
			provider: context.provider,
			model: context.model,
			endpoint: sanitizeEndpoint(context.endpoint),
			audioMimeType: context.audioMimeType,
			audioBytes: context.audioBytes,
			rayId: context.rayId,
			error: serializeError(error, privateValues),
		}),
	);
}
