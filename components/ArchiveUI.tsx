'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { MicrosoftIqLayer, MicrosoftIqMode, MuseumGenerationProvider } from '@/lib/museum-generation';

type Tone = 'dark' | 'light';

const navItems = [
  { href: '/', label: 'Home', icon: '⌂', match: '/' },
  { href: '/explore', label: 'Explore', icon: '⌕', match: '/explore' },
  { href: '/museum', label: 'Museum', icon: '▥', match: '/museum' },
  { href: '/add-memory', label: 'My Memories', icon: '▣', match: '/add-memory' },
  { href: '/#about', label: 'About', icon: 'ⓘ', match: '/#about' },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ArchiveShell({
  children,
  className,
  hideTopbar = false,
}: {
  children: ReactNode;
  className?: string;
  hideTopbar?: boolean;
}) {
  return (
    <main className="archive-bg">
      <ArchiveSidebar />
      <section className={cx('archive-workspace', className)}>
        {hideTopbar ? null : <ArchiveTopbar />}
        {children}
      </section>
      <ArchiveMobileNav />
    </main>
  );
}

export function ArchiveSidebar() {
  const pathname = usePathname();

  return (
    <aside className="archive-sidebar">
      <Link href="/" className="archive-brand">
        <span className="archive-brand-logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" className="archive-brand-logo-image">
            <path d="M12 50V20l20-10 20 10v30" />
            <path d="M20 50V25h24v25M27 50V34h10v16" />
            <circle cx="32" cy="20" r="3" />
          </svg>
        </span>
        <span className="archive-brand-copy">
          <span className="archive-brand-title">Reality Archive</span>
          <span className="archive-brand-tagline">Places that remember you.</span>
        </span>
      </Link>

      <nav className="archive-side-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive = item.match === '/' ? pathname === '/' : pathname.startsWith(item.match);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cx('archive-side-link', isActive && 'is-active')}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <TornPaperCard tone="light" className="archive-quote-card">
        <p>We do not remember days, we remember places.</p>
        <small>- Cesare Pavese</small>
      </TornPaperCard>
    </aside>
  );
}

export function ArchiveMobileNav() {
  return (
    <nav className="archive-mobile-nav" aria-label="Mobile navigation">
      {navItems.slice(0, 4).map((item) => (
        <Link key={item.label} href={item.href}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function ArchiveTopbar() {
  return (
    <header className="archive-topbar">
      <p>Explore. Remember. Preserve.</p>
      <form action="/explore" className="archive-search">
        <span aria-hidden="true">⌕</span>
        <input name="q" placeholder="Search places, memories, themes..." />
      </form>
    </header>
  );
}

export function ArchiveSectionHeader({
  title,
  href,
  action = 'View all',
}: {
  title: string;
  href?: string | { pathname: string; query?: Record<string, string> };
  action?: string;
}) {
  return (
    <div className="archive-section-header">
      <h2>{title}</h2>
      {href ? <Link href={href}>{action}</Link> : null}
    </div>
  );
}

export function TornPaperCard({
  tone = 'dark',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <article className={cx('torn-paper', tone === 'light' ? 'torn-paper-light' : 'torn-paper-dark', className)}>{children}</article>;
}

export function TornPaperNote({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cx('torn-paper', 'torn-paper-light', 'archive-note', className)}>{children}</aside>;
}

export function InkPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('ink-panel', className)}>{children}</section>;
}

export function MuseumPlaque({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('museum-plaque', className)}>{children}</div>;
}

export function TornPaperButton({
  href,
  children,
  tone = 'light',
  className,
  disabled,
  onClick,
  type = 'button',
}: {
  href?: string | { pathname: string; query?: Record<string, string> };
  children: ReactNode;
  tone?: Tone;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const buttonClass = cx('archive-button', tone === 'light' ? 'archive-button-light' : 'archive-button-dark', className);

  if (href && !disabled) {
    return (
      <Link href={href} className={buttonClass}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={buttonClass}>
      {children}
    </button>
  );
}

export function EmptyArchiveState({
  icon = '⌖',
  title,
  detail,
  className,
  action,
}: {
  icon?: string;
  title: string;
  detail: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cx('archive-empty', className)}>
      <span className="archive-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{title}</p>
      <small>{detail}</small>
      {action ? <div className="archive-empty-action">{action}</div> : null}
    </div>
  );
}

export function ArchiveStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="archive-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function MemoryNoteCard({
  title,
  meta,
  note,
  children,
}: {
  title: string;
  meta?: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <TornPaperCard tone="light" className="memory-note-card">
      <h3>{title}</h3>
      {meta ? <p className="memory-note-meta">{meta}</p> : null}
      <p>{note}</p>
      {children}
    </TornPaperCard>
  );
}

export function CitationLedgerCard({ title, items }: { title: string; items: string[] }) {
  return (
    <InkPanel className="citation-ledger-card">
      <ArchiveSectionHeader title={title} />
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </InkPanel>
  );
}

export function MicrosoftIqLedger({
  layer,
  mode,
  provider,
  sources,
  citations,
  indexedSourceChunkCount,
  action,
  status,
}: {
  layer: MicrosoftIqLayer;
  mode: MicrosoftIqMode;
  provider: MuseumGenerationProvider | null;
  sources: string[];
  citations: string[];
  indexedSourceChunkCount: number | null;
  action?: ReactNode;
  status?: ReactNode;
}) {
  const providerLabel = provider === 'foundry-iq' ? 'Foundry IQ' : provider === 'fallback' ? 'Static preview' : 'curating';

  return (
    <InkPanel className="microsoft-iq-ledger">
      <ArchiveSectionHeader title="Microsoft IQ / Foundry IQ Grounding" />
      <div className="ledger-grid">
        <ArchiveStat label="Microsoft IQ layer" value={layer === 'foundry-iq' ? 'Foundry IQ' : layer} />
        <ArchiveStat label="Retrieval backend" value="Azure AI Search" />
        <ArchiveStat label="Mode" value={mode === 'live' ? 'Live' : 'Prepared'} />
        <ArchiveStat label="Runtime provider" value={providerLabel} />
        <ArchiveStat label="Source chunks" value={indexedSourceChunkCount ?? 'Not indexed'} />
      </div>
      {status ? <div className="ledger-status">{status}</div> : null}
      {action ? <div className="ledger-action">{action}</div> : null}
      <div className="ledger-columns">
        <CitationLedgerCard title="Sources Used" items={sources} />
        <CitationLedgerCard title="Citations" items={citations} />
      </div>
    </InkPanel>
  );
}
