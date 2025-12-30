"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#27272a] bg-[#09090b]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <span className="text-lg font-bold text-white">SnapStudio</span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-8 text-sm text-[#a1a1aa]">
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/#styles" className="hover:text-white transition-colors">
              Styles
            </Link>
            <Link href="/generate" className="hover:text-white transition-colors">
              Generate
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-[#71717a]">
            &copy; {new Date().getFullYear()} SnapStudio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
