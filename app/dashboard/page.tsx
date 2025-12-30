'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/dashboard/header';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentGenerations } from '@/components/dashboard/recent-generations';
import { getStats, type GeneratedImage } from '@/lib/storage';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalGenerated: 0,
    totalFavorites: 0,
    creditsRemaining: 10,
    recentGenerations: [] as GeneratedImage[],
    styleBreakdown: {} as Record<string, number>
  });

  useEffect(() => {
    const loadedStats = getStats();
    setStats(loadedStats);
  }, []);

  return (
    <>
      <Header
        title="Welcome back!"
        subtitle="Create stunning professional headshots in seconds"
        action={{
          label: 'Create Headshot',
          href: '/dashboard/create',
          icon: 'add_photo_alternate'
        }}
      />

      <StatsCards stats={stats} />

      <QuickActions />

      <RecentGenerations images={stats.recentGenerations} />

      {/* Tips section */}
      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-indigo-400">tips_and_updates</span>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Pro Tip</h3>
            <p className="text-sm text-zinc-400">
              For best results, use a well-lit selfie where your face is clearly visible and facing the camera.
              Natural daylight works great! Our AI will handle the rest.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
