import { Check, ChevronDown, Globe2, ListPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TargetDomain } from '../shared/types';

interface DomainSelectProps {
  domains: TargetDomain[];
  selectedId: string;
  onSelect: (domain: TargetDomain) => void;
  onManage: () => void;
}

export default function DomainSelect({ domains, selectedId, onSelect, onManage }: DomainSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = domains.find((item) => item.id === selectedId) ?? domains[0];
  const selectedIndex = Math.max(0, domains.findIndex((item) => item.id === selected?.id));

  const openList = (index = selectedIndex) => {
    setActiveIndex(Math.max(0, Math.min(index, domains.length - 1)));
    setOpen(true);
  };

  const selectAt = (index: number) => {
    const item = domains[index];
    if (!item) return;
    onSelect(item);
    setOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex items-stretch gap-2" ref={rootRef}>
      <div className="relative min-w-0 flex-1">
        <button
          className="flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-left text-xs font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(20,30,55,.04)] transition hover:border-[color-mix(in_srgb,var(--brand)_45%,var(--line))] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]"
          type="button"
          role="combobox"
          aria-controls="domain-listbox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `domain-option-${domains[activeIndex]?.id}` : undefined}
          onClick={() => open ? setOpen(false) : openList()}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!open) openList();
              else setActiveIndex((index) => Math.min(index + 1, domains.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) openList();
              else setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (open && event.key === 'Home') {
              event.preventDefault();
              setActiveIndex(0);
            }
            if (open && event.key === 'End') {
              event.preventDefault();
              setActiveIndex(Math.max(0, domains.length - 1));
            }
            if (open && event.key === 'Enter') {
              event.preventDefault();
              selectAt(activeIndex);
            }
          }}
        >
          <Globe2 className="shrink-0 text-[var(--brand)]" size={15} />
          <span className="min-w-0 flex-1 truncate">{selected?.domain ?? 'No domains configured'}</span>
          <ChevronDown className={`shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} size={15} />
        </button>

        {open && (
          <div
            className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_16px_38px_rgba(20,30,55,.18)]"
            id="domain-listbox"
            role="listbox"
          >
            {domains.map((item, index) => {
              const active = item.id === selected?.id;
              const focused = index === activeIndex;
              return (
                <button
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs transition ${active ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : focused ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text)] hover:bg-[var(--surface-2)]'}`}
                  key={item.id}
                  id={`domain-option-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    selectAt(index);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{item.domain}</span>
                  {active && <Check className="shrink-0" size={14} strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[color-mix(in_srgb,var(--brand)_35%,var(--line))] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]"
        type="button"
        aria-label="Manage target domains"
        title="Manage target domains"
        onClick={() => {
          setOpen(false);
          onManage();
        }}
      >
        <ListPlus size={17} />
      </button>
    </div>
  );
}
