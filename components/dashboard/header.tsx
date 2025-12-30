'use client';

import Link from 'next/link';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href: string;
    icon?: string;
  };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25"
        >
          {action.icon && <span className="material-symbols-outlined">{action.icon}</span>}
          {action.label}
        </Link>
      )}
    </header>
  );
}
