import type { ReactNode } from 'react';

export function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} className="grid scroll-mt-6 gap-4 sm:gap-5 border-t border-border py-4 sm:py-7 xl:grid-cols-[230px_minmax(0,1fr)]">
    <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-muted-foreground">{description}</p></div>
    <div className="work-panel p-3.5 sm:p-6">{children}</div>
  </section>;
}
