'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Home', icon: '⌂', note: 'Start' },
  { href: '/explore', label: 'Explore', icon: '⌕', note: 'Map' },
  { href: '/museum', label: 'Museum', icon: '⌂', note: 'AI' },
  { href: '/add-memory', label: 'My Memories', icon: '▣', note: 'Notes' },
  { href: '/#about', label: 'About', icon: 'ⓘ', note: 'Info' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="ra-nav">
      <ul className="ra-nav__list">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="ra-nav__item">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="ra-nav__link"
              >
                <span className="ra-nav__icon">{item.icon}</span>
                <span className="ra-nav__label">{item.label}</span>
                <span className="ra-nav__note">{item.note}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
