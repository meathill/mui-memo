'use client';

import { Button } from '@/components/ui/button';
import { ASSETS_URL } from '@/lib/config';
import { cn } from '@/lib/utils';
import { PaperclipIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';

export interface Attachment {
  id: string;
  key: string;
  mime: string;
  size: number;
  originalName: string | null;
  createdAt: string;
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({ att, onDelete }: { att: Attachment; onDelete: () => void }) {
  const url = `${ASSETS_URL}/${att.key}`;
  const name = att.originalName ?? '附件';
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
          <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
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
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="删除附件">
        <TrashIcon />
      </Button>
    </li>
  );
}

/**
 * 附件区：点上传 + 拖拽上传。
 * 整块区域都是 drop zone，拖拽时高亮边框。
 */
export function AttachmentsSection({
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
        'mt-8 space-y-3 rounded-2xl p-2 transition-colors',
        dragOver && 'bg-accent-warm/10 ring-2 ring-accent-warm/60',
      )}
      onDragEnter={(e) => {
        // 只有真的拖了文件才响应
        if (e.dataTransfer.types?.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types?.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
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
        <h2 className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-mute">附件 · {attachments.length}</h2>
        <Button variant="outline" size="sm" onClick={onPickFile} loading={uploading}>
          <PaperclipIcon />
          上传
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={onUploadChange} />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule/60 px-4 py-6 text-center text-sm text-ink-mute">
          还没有附件。点击上方按钮，或直接把文件拖到这里。
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <AttachmentItem key={a.id} att={a} onDelete={() => onDelete(a.id)} />
          ))}
        </ul>
      )}

      {dragOver ? <p className="font-mono text-[11px] text-accent-warm text-center">松开上传到此任务</p> : null}
    </section>
  );
}
