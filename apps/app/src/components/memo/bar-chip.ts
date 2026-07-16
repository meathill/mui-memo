import type { BarChip } from "@mui-memo/shared/logic";
import { PLACE_LABEL } from "@mui-memo/shared/logic";

/**
 * 芯片显示文案：场景复用共享的 PLACE_LABEL，但 any 保留筛选栏既有的「全部」措辞
 * （不用 PLACE_LABEL.any 的「不限」，避免首页视觉回归）；标签直接显示标签文本。
 */
export function chipLabel(chip: BarChip): string {
	if (chip.kind === "tag") return chip.tag;
	return chip.place === "any" ? "全部" : PLACE_LABEL[chip.place].label;
}

/** 芯片唯一键：用作 React key，以及包含/相等判断。 */
export function chipKey(chip: BarChip): string {
	return chip.kind === "tag" ? `tag:${chip.tag}` : `place:${chip.place}`;
}

export function sameChip(a: BarChip, b: BarChip): boolean {
	return chipKey(a) === chipKey(b);
}
