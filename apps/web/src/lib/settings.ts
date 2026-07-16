export type CheckAnim = "strike" | "fade" | "fly";

export const CHECK_ANIMS: { value: CheckAnim; label: string; hint: string }[] =
  [
    { value: "strike", label: "Strike", hint: "划线" },
    { value: "fade", label: "Fade", hint: "淡出" },
    { value: "fly", label: "Fly", hint: "飞走" },
  ];

export const CHECK_ANIM_DURATION: Record<CheckAnim, number> = {
  strike: 260,
  fade: 300,
  fly: 340,
};

export const CHECK_ANIM_STORAGE_KEY = "muimemo:check-anim";

export function readCheckAnim(): CheckAnim {
  if (typeof window === "undefined") return "strike";
  const raw = window.localStorage.getItem(CHECK_ANIM_STORAGE_KEY);
  return raw === "fade" || raw === "fly" ? raw : "strike";
}

export function writeCheckAnim(anim: CheckAnim) {
  window.localStorage.setItem(CHECK_ANIM_STORAGE_KEY, anim);
  window.dispatchEvent(new CustomEvent("muimemo:check-anim-change"));
}
