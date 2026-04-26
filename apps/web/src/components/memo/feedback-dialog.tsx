'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { submitFeedback } from '@/lib/feedback';

const TAG_OPTIONS = ['bug', '建议', '其他'] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultContact?: string;
}

export function FeedbackDialog({ open, onOpenChange, defaultContact }: Props) {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState(defaultContact ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function reset() {
    setContent('');
    setTags([]);
    setError(null);
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) {
      setError('请填写反馈内容');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitFeedback({ content: text, contact: contact.trim(), tags });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>意见反馈</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">反馈内容</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="遇到了什么问题？或者你想要什么功能？"
              rows={5}
              className="mt-1 min-h-28 w-full resize-none rounded-xl border border-rule/60 bg-paper-2/50 px-3 py-2 font-serif text-base leading-relaxed text-ink outline-none focus:border-ink/60"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">联系方式（选填）</span>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="邮箱 / 微信，方便我们联系你"
              className="mt-1 h-10 w-full rounded-xl border border-rule/60 bg-paper-2/50 px-3 font-mono text-sm text-ink outline-none focus:border-ink/60"
            />
          </label>

          <div>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">标签</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={
                      'rounded-full border px-3 py-1 font-mono text-xs transition-colors ' +
                      (selected
                        ? 'border-ink bg-ink text-paper'
                        : 'border-rule/60 bg-paper-2/50 text-ink-mute hover:text-ink')
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <Button onClick={handleSubmit} loading={busy}>
            提交
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
