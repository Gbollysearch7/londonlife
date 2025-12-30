'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Styles', href: '#styles' },
  { label: 'Examples', href: '#examples' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' }
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
              </div>
              <span className="text-lg font-bold">SnapStudio</span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/create"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                Create Headshot
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white"
            >
              <span className="material-symbols-outlined">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-950 border-t border-zinc-800">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <Link
                  href="/dashboard"
                  className="block py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/create"
                  className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-center font-medium rounded-lg transition-colors"
                >
                  Create Headshot
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  );
}
