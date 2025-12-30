'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    description: 'Overview & stats'
  },
  {
    label: 'Create New',
    href: '/dashboard/create',
    icon: 'add_photo_alternate',
    description: 'Generate headshots',
    highlight: true
  },
  {
    label: 'My Gallery',
    href: '/dashboard/gallery',
    icon: 'photo_library',
    description: 'All your headshots'
  },
  {
    label: 'Favorites',
    href: '/dashboard/favorites',
    icon: 'favorite',
    description: 'Saved headshots'
  },
  {
    label: 'History',
    href: '/dashboard/history',
    icon: 'history',
    description: 'Generation history'
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: 'settings',
    description: 'Preferences'
  }
];

const bottomNavItems = [
  {
    label: 'Help Center',
    href: '#',
    icon: 'help'
  },
  {
    label: 'Back to Home',
    href: '/',
    icon: 'home'
  }
];

interface SidebarProps {
  credits?: number;
}

export function Sidebar({ credits = 10 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-zinc-950 border-r border-zinc-800 transition-all duration-300 z-40 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
            </div>
            {!collapsed && <span className="text-lg font-bold">SnapStudio</span>}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Credits indicator */}
        <div className={`px-4 py-4 border-b border-zinc-800 ${collapsed ? 'text-center' : ''}`}>
          {collapsed ? (
            <div className="w-10 h-10 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-400">{credits}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">Credits remaining</span>
                <span className="material-symbols-outlined text-indigo-400 text-lg">toll</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{credits}</span>
                <span className="text-xs text-zinc-500">headshots</span>
              </div>
              <Link
                href="/dashboard/pricing"
                className="mt-2 block w-full py-1.5 text-center text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Get more credits →
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : item.highlight
                    ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`material-symbols-outlined text-xl ${
                  isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : ''
                }`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.description && (
                      <div className={`text-xs ${isActive ? 'text-indigo-100' : 'text-zinc-500'}`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                )}
                {!collapsed && item.highlight && !isActive && (
                  <span className="material-symbols-outlined text-lg text-indigo-400">add</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-zinc-500'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${
                  item.highlight && !isActive ? 'bg-indigo-600 text-white rounded-lg p-1' : ''
                }`}>
                  {item.icon}
                </span>
                <span className="text-xs">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for fixed sidebar */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`} />
    </>
  );
}
