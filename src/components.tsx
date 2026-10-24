import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight } from 'lucide-react';

const openDialogs = new Set<HTMLElement>();
let bodyOverflow = '';
const focusSelector = 'button,a[href],input:not([type="hidden"]),select,textarea,[tabindex]';
function focusable(root: HTMLElement, firstOnly = false) {
  const hasLayout = root.getClientRects().length > 0;
  const nodes: HTMLElement[] = [];
  for (const node of root.querySelectorAll<HTMLElement>(focusSelector)) {
    if (node.tabIndex < 0 || node.matches(':disabled') || node.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
    if (hasLayout) {
      if (!node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') continue;
    } else {
      // Native hidden and inline visibility also work in layout-free renderers.
      let parent: HTMLElement | null = node;
      let hidden = false;
      while (parent && parent !== root.parentElement) {
        if (parent.style.display === 'none' || parent.style.visibility === 'hidden') { hidden = true; break; }
        parent = parent.parentElement;
      }
      if (hidden) continue;
    }
    nodes.push(node);
    if (firstOnly) break;
  }
  return nodes;
}
export function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!openDialogs.size) bodyOverflow = document.body.style.overflow;
    openDialogs.add(root);
    document.body.style.overflow = 'hidden';
    const top = () => Array.from(openDialogs).filter(d => d.isConnected).at(-1);
    const focusFirst = () => (focusable(root, true)[0] || root).focus();
    focusFirst();
    const onFocus = (e: FocusEvent) => {
      if (top() === root && !root.contains(e.target as Node)) focusFirst();
    };
    const onKey = (e: KeyboardEvent) => {
      if (top() !== root) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); closeRef.current(); return;
      }
      if (e.key === 'Tab') {
        const nodes = focusable(root), first = nodes[0], last = nodes.at(-1);
        if (!nodes.length) { e.preventDefault(); root.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      openDialogs.delete(root);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const active = top();
      if (!openDialogs.size) document.body.style.overflow = bodyOverflow;
      if (previous?.isConnected && (!active || active.contains(previous))) previous.focus();
      else if (active) (focusable(active, true)[0] || active).focus();
    };
  }, []);
  return ref;
}
export function PageHeader({ title, eyebrow, description, actions }: {
  title: string; eyebrow: string; description?: ReactNode; actions?: ReactNode;
}) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="operations-actions">{actions}</div>}</div>;
}
function statusTone(label: string) {
  if (/cancel|overdue|expired|declined|unavailable|maintenance|reaction|lost|no.show|error/i.test(label)) return 'danger';
  if (/await|pending|due|low.stock|review.required|preparation|progress|expiring|unpaid|partial/i.test(label)) return 'warning';
  if (/draft|inactive|paused|not.connected|future|not.assigned|not.recorded/i.test(label)) return 'neutral';
  if (/scheduled|checked.in|import|simulation|demo|booked/i.test(label)) return 'info';
  return 'success';
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className={`badge ${String(children).toLowerCase().replaceAll(' ', '-')}`} data-tone={statusTone(String(children))}>{children}</span>;
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={`avatar ${small ? 'small' : ''}`}>{name.split(' ').slice(0, 2).map(s => s[0]).join('')}</span>;
}
export function Modal({ title, onClose, children, className = '' }: { className?: string; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogFocus(onClose);
  return <div className="overlay" onMouseDown={onClose}><section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onMouseDown={e => e.stopPropagation()}><header><h2>{title}</h2><button type="button" className="icon" onClick={onClose} aria-label="Close" title="Close dialog"><X size={20} /></button></header>{children}</section></div>;
}
export function SectionTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return <div className="section-title"><h3>{title}</h3>{action && <button type="button" className="text-button" onClick={onClick}>{action}<ArrowUpRight size={14} /></button>}</div>;
}
