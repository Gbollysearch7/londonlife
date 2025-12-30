'use client';

import { Sidebar } from '@/components/dashboard/sidebar';
import { getCredits } from '@/lib/storage';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [credits, setCredits] = useState(10);

  useEffect(() => {
    setCredits(getCredits());
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar credits={credits} />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
