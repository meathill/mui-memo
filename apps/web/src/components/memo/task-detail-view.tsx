"use client";

import { ArrowLeftIcon, PaperclipIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSETS_URL, MAX_ATTACHMENT_SIZE } from "@/lib/config";
import { formatDueAt, isoToLocalInput, localInputToISO } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PLACE_LABEL } from "@mui-memo/shared/logic";
import type {
  TaskPlace,
  TaskStatus,
  TaskWindow,
} from "@mui-memo/shared/validators";

interface Task {
  id: string;
  text: string;
  rawText?: string | null;
  place: TaskPlace;
  window: TaskWindow;
  energy: number;
  priority: number;
  tag: string | null;
  deadline: string | null;
  dueAt: string | null;
  audioKey: string | null;
  aiReason: string | null;
  status: TaskStatus;
  linkedTo: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Attachment {
  id: string;
  key: string;
  mime: string;
  size: number;
  originalName: string | null;
  createdAt: string;
}

const PLACES: TaskPlace[] = ["home", "work", "out", "any"];
const WINDOWS: TaskWindow[] = ["now", "today", "later"];
const PRIORITIES = [1, 2, 3] as const;
const STATUSES: TaskStatus[] = ["pending", "doing", "done"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待做",
  doing: "正在做",
  done: "已完成",
  linked: "顺手做",
};
const WINDOW_LABEL: Record<TaskWindow, string> = {
  now: "此刻",
  today: "今天",
  later: "不急",
};
const PRIORITY_LABEL: Record<number, string> = {
  1: "低",
  2: "中",
  3: "高",
};

function isImage(mime: string) {
  return mime.startsWith("image/");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks/${id}`, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) router.replace("/");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      task: Task;
      attachments: Attachment[];
    };
    setTask(data.task);
    setAttachments(data.attachments);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (fields: Partial<Task>) => {
      if (!task) return;
      setTask({ ...task, ...fields });
      setSaving(true);
      const body: Record<string, unknown> = {};
      if (fields.text !== undefined) body.text = fields.text;
      if (fields.place !== undefined) body.place = fields.place;
      if (fields.window !== undefined) body.window = fields.window;
      if (fields.priority !== undefined) body.priority = fields.priority;
      if (fields.tag !== undefined) body.tag = fields.tag || undefined;
      if (fields.deadline !== undefined)
        body.deadline = fields.deadline || undefined;
      if (fields.dueAt !== undefined) body.dueAt = fields.dueAt ?? null;
      if (fields.status !== undefined) body.status = fields.status;
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) setError("保存失败");
      } finally {
        setSaving(false);
      }
    },
    [id, task],
  );

  const uploadOne = useCallback(
    async (file: File) => {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`文件过大，≤ ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB`);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${id}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setError("上传失败");
        return;
      }
      const data = (await res.json()) as { attachment: Attachment };
      setAttachments((prev) => [...prev, data.attachment]);
    },
    [id],
  );

  const uploadMany = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      setError(null);
      try {
        for (const f of files) {
          // 串行上传：Worker 请求并发 + 小用户体感，不值得并行
          await uploadOne(f);
        }
      } finally {
        setUploading(false);
      }
    },
    [uploadOne],
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await uploadMany(files);
  }

  async function handleDeleteAttachment(attId: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
    await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
  }

  if (loading || !task) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4">
        <p className="text-sm text-ink-mute">加载中…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="返回"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
            任务详情
          </p>
          <p className="truncate text-xs text-ink-mute font-mono">
            {new Date(task.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
        {saving ? (
          <span className="font-mono text-[10px] text-ink-mute">保存中…</span>
        ) : null}
      </header>

      <section className="mt-6 space-y-5">
        <Field label="内容">
          <textarea
            defaultValue={task.text}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.text) patch({ text: v });
            }}
            className="min-h-24 w-full resize-none rounded-xl border border-rule/60 bg-paper-2/50 px-3 py-2 font-serif text-base leading-relaxed text-ink outline-none focus:border-ink/60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="状态">
            <Segmented
              value={task.status === "linked" ? "pending" : task.status}
              options={STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
              onChange={(v) => patch({ status: v as TaskStatus })}
            />
          </Field>
          <Field label="优先级">
            <Segmented
              value={String(task.priority)}
              options={PRIORITIES.map((p) => ({
                value: String(p),
                label: PRIORITY_LABEL[p],
              }))}
              onChange={(v) => patch({ priority: Number(v) })}
            />
          </Field>
          <Field label="地点">
            <Segmented
              value={task.place}
              options={PLACES.map((p) => ({
                value: p,
                label: `${PLACE_LABEL[p].icon} ${PLACE_LABEL[p].label}`,
              }))}
              onChange={(v) => patch({ place: v as TaskPlace })}
            />
          </Field>
          <Field label="时段">
            <Segmented
              value={task.window}
              options={WINDOWS.map((w) => ({
                value: w,
                label: WINDOW_LABEL[w],
              }))}
              onChange={(v) => patch({ window: v as TaskWindow })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="标签">
            <Input
              defaultValue={task.tag ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (task.tag ?? "")) patch({ tag: v });
              }}
              placeholder="工作 / 家务 / …"
              size="default"
            />
          </Field>
          <Field label="截止">
            <Input
              defaultValue={task.deadline ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (task.deadline ?? "")) patch({ deadline: v });
              }}
              placeholder="下周一 / 17:00"
              size="default"
            />
            <DueAtRow
              dueAt={task.dueAt}
              onChange={(iso) => patch({ dueAt: iso ?? undefined })}
            />
          </Field>
        </div>

        {task.aiReason ? (
          <p className="rounded-xl border border-rule/60 bg-paper-2/40 px-3 py-2 text-xs text-ink-soft font-mono">
            🤖 {task.aiReason}
          </p>
        ) : null}

        {task.rawText && task.rawText !== task.text ? (
          <details className="rounded-xl border border-rule/60 bg-paper-2/40 px-3 py-2">
            <summary className="cursor-pointer font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">
              原话
            </summary>
            <p className="mt-1 text-sm text-ink-soft">{task.rawText}</p>
          </details>
        ) : null}

        {task.audioKey ? (
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">
              原始语音
            </p>
            {/* biome-ignore lint/a11y/useMediaCaption: 用户录的语音备忘，没有字幕源 */}
            <audio
              controls
              preload="none"
              src={`/api/audio/${task.audioKey}`}
              className="w-full"
              data-testid="task-audio"
            />
          </div>
        ) : null}
      </section>

      <AttachmentsSection
        attachments={attachments}
        uploading={uploading}
        error={error}
        fileRef={fileRef}
        onPickFile={() => fileRef.current?.click()}
        onUploadChange={handleUpload}
        onDrop={uploadMany}
        onDelete={handleDeleteAttachment}
      />
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-paper-2/50 p-1 ring-1 ring-rule/50">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-center text-xs transition-colors whitespace-nowrap",
            value === o.value
              ? "bg-ink text-paper"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AttachmentItem({
  att,
  onDelete,
}: {
  att: Attachment;
  onDelete: () => void;
}) {
  const url = `${ASSETS_URL}/${att.key}`;
  const name = att.originalName ?? "附件";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-rule/60 bg-paper-2/40 p-2">
      {isImage(att.mime) ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-paper ring-1 ring-rule/50"
        >
          {/* biome-ignore lint/performance/noImgElement: 外链 R2 资源，不走 next/image */}
          <img
            src={url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-paper ring-1 ring-rule/50">
          <PaperclipIcon className="h-5 w-5 text-ink-mute" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-serif text-sm text-ink hover:underline"
        >
          {name}
        </a>
        <p className="text-[11px] font-mono text-ink-mute">
          {att.mime} · {formatSize(att.size)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="删除附件"
      >
        <TrashIcon />
      </Button>
    </li>
  );
}

/**
 * 一行灰色辅助文案：默认展示 AI 解析出的 dueAt；点一下变成
 * datetime-local 输入框，blur 或按 Enter 保存。
 */
function DueAtRow({
  dueAt,
  onChange,
}: {
  dueAt: string | null;
  onChange: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        type="datetime-local"
        defaultValue={isoToLocalInput(dueAt)}
        autoFocus
        className="mt-1 w-full rounded-lg border border-rule/60 bg-paper-2/50 px-2 py-1 font-mono text-xs text-ink outline-none focus:border-ink/60"
        onBlur={(e) => {
          const iso = localInputToISO(e.target.value);
          setEditing(false);
          if (iso !== dueAt) onChange(iso);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1 block w-full text-left font-mono text-[10px] text-ink-mute hover:text-ink-soft"
      aria-label="编辑截止时间"
    >
      {dueAt ? `→ ${formatDueAt(dueAt)}` : "→ 点击设置具体时间"}
    </button>
  );
}

/**
 * 附件区：点上传 + 拖拽上传。
 * 整块区域都是 drop zone，拖拽时高亮边框。
 */
function AttachmentsSection({
  attachments,
  uploading,
  error,
  fileRef,
  onPickFile,
  onUploadChange,
  onDrop,
  onDelete,
}: {
  attachments: Attachment[];
  uploading: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (files: File[]) => void | Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
      data-testid="attachments"
      className={cn(
        "mt-8 space-y-3 rounded-2xl p-2 transition-colors",
        dragOver && "bg-accent-warm/10 ring-2 ring-accent-warm/60",
      )}
      onDragEnter={(e) => {
        // 只有真的拖了文件才响应
        if (e.dataTransfer.types?.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types?.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(e) => {
        // 离开到子元素不算
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onDrop(files);
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-mute">
          附件 · {attachments.length}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onPickFile}
          loading={uploading}
        >
          <PaperclipIcon />
          上传
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={onUploadChange}
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule/60 px-4 py-6 text-center text-sm text-ink-mute">
          还没有附件。点击上方按钮，或直接把文件拖到这里。
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <AttachmentItem
              key={a.id}
              att={a}
              onDelete={() => onDelete(a.id)}
            />
          ))}
        </ul>
      )}

      {dragOver ? (
        <p className="font-mono text-[11px] text-accent-warm text-center">
          松开上传到此任务
        </p>
      ) : null}
    </section>
  );
}
