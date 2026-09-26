import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'AI API', href: '#ai-api' },
  { label: 'ATEGateway', href: '#ategateway' },
  { label: 'Documentation', href: '#docs' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile menu is open; restore on close/unmount.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open ]);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto w-full max-w-[1800px] px-[20px] sm:px-[32px] md:px-[82px]">
        <div className="flex items-center justify-between gap-4 pt-5 sm:pt-6">
          {/* Brand / logo — 0ms */}
          <a
            href="#top"
            aria-label="Akmal Taufik Enterprise — Infotech Solution"
            className="anim anim-fade-down flex min-w-0 items-center gap-3"
            style={{ animationDelay: '0ms' }}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[15px] font-semibold tracking-tight text-white backdrop-blur-[17px]"
            >
              A
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              {/* Wordmark approx 22px base / 26px sm for the monogram line;
                  full enterprise name stacks beneath to avoid 375px overflow. */}
              <span className="truncate text-[22px] font-medium tracking-tight text-white sm:text-[26px]">
                ATE
              </span>
              <span className="mt-1 truncate text-[10px] font-medium tracking-[0.32em] text-white/60">
                AKMAL TAUFIK ENTERPRISE
              </span>
              <span className="mt-0.5 truncate text-[9px] font-medium tracking-[0.32em] text-white/40">
                INFOTECH SOLUTION
              </span>
            </span>
          </a>

          {/* Desktop center nav pill — 100ms */}
          <nav
            aria-label="Primary"
            className="anim anim-fade-down hidden lg:block"
            style={{ animationDelay: '100ms' }}
          >
            <ul className="flex items-center gap-1 rounded-full border border-white/10 bg-[rgba(10,7,7,0.35)] p-1.5 backdrop-blur-[17px]">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="block rounded-full px-5 py-2.5 text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Desktop right actions — 200ms */}
          <div
            className="anim anim-fade-down hidden items-center gap-2 lg:flex"
            style={{ animationDelay: '200ms' }}
          >
            <a
              href="#login"
              className="rounded-full border border-white/10 bg-[rgba(0,0,0,0.35)] px-5 py-2.5 text-[14px] font-medium text-white/85 backdrop-blur-[17px] transition-colors hover:bg-white/10 hover:text-white"
            >
              Customer Login
            </a>
            <a
              href="#get-started"
              className="rounded-full bg-[#E9E9E9] px-5 py-2.5 text-[14px] font-semibold text-[#0A0707] transition-colors hover:bg-white"
            >
              Get Started
            </a>
          </div>

          {/* Mobile hamburger — 100ms. Both icons stay mounted, cross-fade/rotate/scale. */}
          <div
            className="anim anim-fade-down lg:hidden"
            style={{ animationDelay: '100ms' }}
          >
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/10 bg-[rgba(10,7,7,0.35)] text-white backdrop-blur-[17px] transition-colors hover:bg-white/10"
            >
              <span className="relative block h-[20px] w-[20px]" aria-hidden="true">
                <Menu
                  size={20}
                  className={`absolute inset-0 h-[20px] w-[20px] transition-all duration-300 ${
                    open ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
                  }`}
                />
                <X
                  size={20}
                  className={`absolute inset-0 h-[20px] w-[20px] transition-all duration-300 ${
                    open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile panel — stays mounted, visibility/opacity/transform transition */}
        <div
          id="mobile-menu"
          aria-hidden={!open}
          className={`lg:hidden ${
            open ? 'visible opacity-100' : 'invisible opacity-0'
          } transition-all duration-300`}
        >
          <nav
            aria-label="Mobile"
            className={`mt-3 rounded-3xl border border-white/10 bg-[rgba(10,7,7,0.35)] p-3 backdrop-blur-[30px] transition-all duration-300 ${
              open ? 'translate-y-0 scale-100' : '-translate-y-2 scale-[0.98]'
            }`}
          >
            {/* Backdrop blur layer for the page behind the panel */}
            <div
              aria-hidden="true"
              className={`fixed inset-0 -z-10 bg-black/30 backdrop-blur-[24px] transition-opacity duration-300 ${
                open ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3.5 text-[15px] font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <a
                href="#login"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="block rounded-2xl border border-white/10 bg-[rgba(0,0,0,0.35)] px-4 py-3.5 text-center text-[15px] font-medium text-white backdrop-blur-[24px] transition-colors hover:bg-white/10"
              >
                Customer Login
              </a>
              <a
                href="#get-started"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="block rounded-2xl bg-[#E9E9E9] px-4 py-3.5 text-center text-[15px] font-semibold text-[#0A0707] transition-colors hover:bg-white"
              >
                Get Started
              </a>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
