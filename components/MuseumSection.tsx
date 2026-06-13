import type { ReactNode } from 'react';

interface MuseumSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  accent?: 'amber' | 'emerald' | 'violet';
  children?: ReactNode;
}

const accentMap = {
  amber: 'museum-section--warm',
  emerald: 'museum-section--green',
  violet: 'museum-section--plain',
};

export function MuseumSection({ eyebrow, title, description, accent = 'amber', children }: MuseumSectionProps) {
  return (
    <section className={`ink-panel museum-section ${accentMap[accent]}`}>
      <p className="archive-kicker">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      {children ? <div className="museum-section-body">{children}</div> : null}
    </section>
  );
}
