"use client";

import type { IntentEffect } from "@mui-memo/shared/logic";
import type { Action, Utterance } from "@mui-memo/shared/validators";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmChoice = "confirm" | "modify-as-add" | "cancel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  effect: IntentEffect | null;
  utterance: Utterance | null;
  /** 在 utterance.actions 中的下标，定位对应 action（决定能否"改为新增"） */
  actionIndex: number;
  onChoose: (choice: ConfirmChoice) => Promise<void> | void;
}

/**
 * AI 改任务确认弹窗。MODIFY 给三按钮，DONE 给两按钮。
 */
export function IntentConfirmDialog({
  open,
  onOpenChange,
  effect,
  utterance,
  actionIndex,
  onChoose,
}: Props) {
  const [busy, setBusy] = useState<ConfirmChoice | null>(null);

  if (!effect) return null;
  const action: Action | undefined = utterance?.actions[actionIndex];

  let title: string;
  let description: string;
  let showAsAdd = false;

  if (effect.kind === "modify") {
    title = `要把任务改成这样吗？`;
    const beforeText = effect.before.text ?? effect.text;
    const afterText = effect.patch.text ?? beforeText;
    description =
      beforeText !== afterText
        ? `「${beforeText}」 → 「${afterText}」${effect.reason ? `\n${effect.reason}` : ""}`
        : `「${effect.text}」 ${effect.verb}${effect.reason ? `\n${effect.reason}` : ""}`;
    showAsAdd = action?.intent === "MODIFY"; // 总是 true 此时
  } else if (effect.kind === "done") {
    title = "确认完成？";
    description = `「${effect.text}」`;
  } else {
    return null;
  }

  async function handle(choice: ConfirmChoice) {
    setBusy(choice);
    try {
      await onChoose(choice);
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button
                variant="outline"
                onClick={() => handle("cancel")}
                disabled={busy !== null}
              >
                取消
              </Button>
            }
          />
          {showAsAdd ? (
            <Button
              variant="secondary"
              onClick={() => handle("modify-as-add")}
              loading={busy === "modify-as-add"}
              disabled={busy !== null && busy !== "modify-as-add"}
            >
              改为新增
            </Button>
          ) : null}
          <Button
            variant="default"
            onClick={() => handle("confirm")}
            loading={busy === "confirm"}
            disabled={busy !== null && busy !== "confirm"}
          >
            确认
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
