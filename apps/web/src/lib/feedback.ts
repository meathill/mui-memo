const FEEDBACK_BASE = process.env.NEXT_PUBLIC_FEEDBACK_API_BASE ?? 'https://feedback.roudan.io';

export const FEEDBACK_APP_ID = 'mui-memo-web';

export type FeedbackPayload = {
  content: string;
  contact?: string;
  tags?: string[];
};

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const body = {
    appId: FEEDBACK_APP_ID,
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    },
    content: payload.content,
    contact: payload.contact || undefined,
    tags: payload.tags?.length ? payload.tags : undefined,
  };
  const res = await fetch(`${FEEDBACK_BASE}/api/feedbacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`提交失败 (${res.status})`);
  }
}
