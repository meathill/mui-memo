'use client';

import { PLACE_LABEL } from '@mui-memo/shared/logic';
import type { TaskPlace, TaskStatus, TaskWindow } from '@mui-memo/shared/validators';
import { ArrowLeftIcon, RotateCcwIcon, TrashIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { MAX_ATTACHMENT_SIZE } from '@/lib/config';
import { ConfirmDialog } from './confirm-dialog';
import { type Attachment, AttachmentsSection } from './task-detail-attachments';
import {
  Field,
  PLACES,
  PRIORITIES,
  PRIORITY_LABEL,
  Segmented,
  STATUS_LABEL,
  STATUSES,
  TimeRow,
  WINDOW_LABEL,
  WINDOWS,
} from './task-detail-fields';

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
  expectAt: string | null;
  dueAt: string | null;
  audioKey: string | null;
  aiReason: string | null;
  status: TaskStatus;
  linkedTo: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function TaskDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDeleteTask() {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('删除失败');
      return;
    }
    track({ name: 'task_delete', source: 'detail' });
    router.push('/app');
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) router.replace('/app');
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
      if (fields.deadline !== undefined) body.deadline = fields.deadline || undefined;
      if (fields.expectAt !== undefined) body.expectAt = fields.expectAt ?? null;
      if (fields.dueAt !== undefined) body.dueAt = fields.dueAt ?? null;
      if (fields.status !== undefined) body.status = fields.status;
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) setError('保存失败');
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
      fd.append('file', file);
      const res = await fetch(`/api/tasks/${id}/attachments`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        setError('上传失败');
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
    e.target.value = '';
    await uploadMany(files);
  }

  async function handleDeleteAttachment(attId: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
    await fetch(`/api/attachments/${attId}`, { method: 'DELETE' });
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
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="返回">
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">任务详情</p>
          <p className="truncate text-xs text-ink-mute font-mono">{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
        </div>
        {saving ? <span className="font-mono text-[10px] text-ink-mute">保存中…</span> : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteOpen(true)}
          aria-label="删除任务"
          data-testid="task-delete-btn"
        >
          <TrashIcon />
        </Button>
      </header>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除任务？"
        description="将同时删除它的附件与原始语音。此操作不可撤销。"
        confirmText="删除"
        destructive
        onConfirm={handleDeleteTask}
      />

      <section className="mt-6 space-y-5">
        <Field label="内容">
          <textarea
            aria-label="内容"
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
              value={task.status === 'linked' ? 'pending' : task.status}
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
              aria-label="标签"
              defaultValue={task.tag ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (task.tag ?? '')) patch({ tag: v });
              }}
              placeholder="工作 / 家务 / …"
              size="default"
            />
          </Field>
          <Field label="时间">
            <Input
              defaultValue={task.deadline ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (task.deadline ?? '')) patch({ deadline: v });
              }}
              placeholder="明天 / 17:00"
              size="default"
            />
            <TimeRow
              label="预期"
              value={task.expectAt}
              overdueHint={task.status !== 'done'}
              onChange={(iso) => patch({ expectAt: iso ?? undefined })}
            />
            <TimeRow
              label="Deadline"
              value={task.dueAt}
              overdueHint={task.status !== 'done'}
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
            <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">原始语音</p>
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

        {task.status === 'done' ? (
          <Button
            variant="outline"
            className="w-full py-6 text-base"
            onClick={async () => {
              try {
                setSaving(true);
                const res = await fetch(`/api/tasks/${task.id}/reopen`, { method: 'POST' });
                if (!res.ok) throw new Error('重启失败');
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : '重启失败');
              } finally {
                setSaving(false);
              }
            }}
          >
            <RotateCcwIcon className="mr-2 h-5 w-5" />
            重新启动
          </Button>
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
