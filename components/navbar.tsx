"use client";

import Link from "next/link";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex h-full items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">SnapStudio</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#styles"
              className="text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors"
            >
              Styles
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors"
            >
              Pricing
            </Link>
          </div>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <Link
              href="/generate"
              className="flex items-center px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 font-semibold text-sm"
            >
              <span className="material-symbols-outlined text-[18px] mr-2">add_circle</span>
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
