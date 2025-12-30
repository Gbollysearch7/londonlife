'use client';

interface StatsCardsProps {
  stats: {
    totalGenerated: number;
    totalFavorites: number;
    creditsRemaining: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: 'Headshots Created',
      value: stats.totalGenerated,
      icon: 'photo_camera',
      color: 'indigo',
      change: '+12 this week'
    },
    {
      label: 'Favorites',
      value: stats.totalFavorites,
      icon: 'favorite',
      color: 'pink',
      change: null
    },
    {
      label: 'Credits Remaining',
      value: stats.creditsRemaining,
      icon: 'toll',
      color: 'emerald',
      change: null,
      action: { label: 'Get more', href: '/dashboard/pricing' }
    }
  ];

  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    indigo: { bg: 'from-indigo-500/10', text: 'text-indigo-400', iconBg: 'bg-indigo-500/20' },
    pink: { bg: 'from-pink-500/10', text: 'text-pink-400', iconBg: 'bg-pink-500/20' },
    emerald: { bg: 'from-emerald-500/10', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20' }
  };

  return (
    <div className="grid sm:grid-cols-3 gap-4 mb-8">
      {cards.map((card) => {
        const colors = colorClasses[card.color];
        return (
          <div
            key={card.label}
            className={`p-5 rounded-2xl bg-gradient-to-br ${colors.bg} to-zinc-900 border border-zinc-800`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${colors.text}`}>{card.icon}</span>
              </div>
              {card.action && (
                <a
                  href={card.action.href}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {card.action.label} →
                </a>
              )}
            </div>
            <div className="text-3xl font-bold mb-1">{card.value}</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">{card.label}</span>
              {card.change && (
                <span className="text-xs text-emerald-400">{card.change}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
