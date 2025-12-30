'use client';

import Link from 'next/link';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Styles', href: '#styles' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Examples', href: '#examples' },
    { label: 'API', href: '#' }
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '#' }
  ],
  resources: [
    { label: 'Help Center', href: '#' },
    { label: 'Tutorials', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'Community', href: '#' },
    { label: 'Status', href: '#' }
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'GDPR', href: '#' }
  ]
};

const socialLinks = [
  { icon: 'X', href: '#', label: 'Twitter' },
  { icon: 'LinkedIn', href: '#', label: 'LinkedIn' },
  { icon: 'Instagram', href: '#', label: 'Instagram' },
  { icon: 'YouTube', href: '#', label: 'YouTube' }
];

export function Footer() {
  return (
    <footer className="relative bg-zinc-950 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white">auto_awesome</span>
              </div>
              <span className="text-xl font-bold">SnapStudio</span>
            </Link>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs">
              Transform any selfie into a professional headshot in under 60 seconds.
              AI-powered, studio-quality results.
            </p>

            {/* Newsletter signup */}
            <div className="mb-6">
              <p className="text-sm font-medium text-zinc-300 mb-2">Stay updated</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
                  Subscribe
                </button>
              </div>
            </div>

            {/* Social links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <span className="text-sm font-medium">{social.icon.charAt(0)}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-zinc-500 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} SnapStudio. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
