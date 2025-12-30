'use client';

import Link from 'next/link';

const actions = [
  {
    title: 'Create New Headshot',
    description: 'Upload a selfie and transform it',
    icon: 'add_photo_alternate',
    href: '/dashboard/create',
    color: 'indigo',
    primary: true
  },
  {
    title: 'Browse Styles',
    description: 'Explore 18+ professional styles',
    icon: 'style',
    href: '/dashboard/create?step=style',
    color: 'purple'
  },
  {
    title: 'View Gallery',
    description: 'See all your generated headshots',
    icon: 'photo_library',
    href: '/dashboard/gallery',
    color: 'emerald'
  },
  {
    title: 'Get More Credits',
    description: 'Purchase additional credits',
    icon: 'toll',
    href: '/dashboard/pricing',
    color: 'amber'
  }
];

export function QuickActions() {
  const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
    indigo: { bg: 'from-indigo-500/10', border: 'border-indigo-500/30', icon: 'text-indigo-400' },
    purple: { bg: 'from-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400' },
    emerald: { bg: 'from-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
    amber: { bg: 'from-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400' }
  };

  return (
    <div className="mb-8">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-indigo-400">bolt</span>
        Quick Actions
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => {
          const colors = colorClasses[action.color];
          return (
            <Link
              key={action.title}
              href={action.href}
              className={`group p-5 rounded-2xl bg-gradient-to-br ${colors.bg} to-zinc-900 border ${
                action.primary ? 'border-indigo-500/50' : 'border-zinc-800'
              } hover:border-indigo-500/50 transition-all hover:-translate-y-1`}
            >
              <div className={`w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <span className={`material-symbols-outlined text-2xl ${colors.icon}`}>
                  {action.icon}
                </span>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-indigo-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-zinc-500">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
