const DEFAULT_TZ = "Asia/Shanghai";

/**
 * 校验时区名合法：不合法返回默认。
 */
export function normalizeTz(tz: string | undefined | null): string {
  if (!tz) return DEFAULT_TZ;
  try {
    // Intl 会抛，抛了就 fallback
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/**
 * 给定一个时间点和时区，返回该时区的 UTC 偏移，形如 "+08:00" / "-05:30"。
 */
export function tzOffset(date: Date, tz: string): string {
  // 通过 formatToParts 取该时区下的年月日时分秒，再减去 UTC 得到偏移。
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // Date.UTC 把那个时区本地时间当 UTC 构造，减去原始毫秒 = 时区偏移
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const offsetMin = Math.round((asUTC - date.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 返回该时刻在目标时区下的 "YYYY-MM-DDTHH:mm:ss±HH:MM" 以及中文星期。
 */
export function describeNow(
  tz: string,
  now: Date = new Date(),
): { iso: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = String(Number(get("hour")) % 24).padStart(2, "0");
  const mi = get("minute");
  const s = get("second");
  const iso = `${y}-${m}-${d}T${h}:${mi}:${s}${tzOffset(now, tz)}`;

  // 计算该时区下的 weekday
  const wd = new Date(`${y}-${m}-${d}T00:00:00Z`).getUTCDay();
  return { iso, weekday: WEEKDAY_ZH[wd] };
}

/**
 * 把 ISO 字符串渲染成 "4月23日 周四 15:00" 这种展示用文本，按目标时区折算。
 */
export function formatDueAt(iso: string, tz: string = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).format(d);
  return parts;
}

export const TZ_DEFAULT = DEFAULT_TZ;

/**
 * `<input type="datetime-local">` 的值格式是 "YYYY-MM-DDTHH:mm"，无时区；
 * 这里把 ISO 转成本地（浏览器时区）下的那种格式给 input 默认值。
 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 反向：`<input type="datetime-local">` 的值（被浏览器当本地时间解读）→ ISO。
 * 空字符串返回 null。
 */
export function localInputToISO(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
