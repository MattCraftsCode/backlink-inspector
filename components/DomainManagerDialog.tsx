import { Globe2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface DomainManagerDialogProps {
  open: boolean;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function DomainManagerDialog({
  open,
  value,
  error,
  onChange,
  onClose,
  onSave,
}: DomainManagerDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onSave();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSave, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.38)] p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="w-full max-w-[360px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(15,23,42,.28)]" role="dialog" aria-modal="true" aria-labelledby="domain-manager-title">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Globe2 size={16} /></span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]" id="domain-manager-title">Manage target domains</h2>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">One domain per line</p>
            </div>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]" type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="p-4">
          <textarea
            ref={textareaRef}
            className="min-h-48 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs leading-5 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]"
            value={value}
            spellCheck={false}
            placeholder={'example.com\nabc.com'}
            onChange={(event) => onChange(event.target.value)}
          />
          {error && <p className="mt-2 rounded-md bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-2 text-[11px] leading-4 text-[var(--danger)]" role="alert">{error}</p>}
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Full URLs are accepted and stored as domains. Duplicate entries are removed automatically.</p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <button className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]" type="button" onClick={onClose}>Cancel</button>
          <button className="domain-save-button h-8 rounded-md bg-[var(--brand)] px-3.5 text-[11px] font-semibold transition hover:bg-[var(--brand-strong)]" type="button" onClick={onSave}>Save domains</button>
        </footer>
      </section>
    </div>
  );
}
