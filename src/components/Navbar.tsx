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
        {/* Three zones: brand / centered nav / actions. At lg+ a 1fr/auto/1fr
            grid keeps the center nav visually centered in the container;
            tighter lg spacing prevents overlap at 1024px, full reference
            geometry (gap 30px, px 24px) applies at xl+. */}
        <div className="flex items-center justify-between gap-4 pt-5 sm:pt-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-0">
          {/* Brand / logo — 0ms */}
          <a
            href="#top"
            aria-label="Akmal Taufik Enterprise — Infotech Solution"
            className="anim anim-fade-down flex min-w-0 items-center gap-2.5 lg:justify-self-start"
            style={{ animationDelay: '0ms' }}
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[14px] font-semibold tracking-tight text-white backdrop-blur-[17px]"
            >
              A
            </span>
            <span className="flex min-w-0 flex-col leading-none">
              {/* Wordmark 22px base / 26px sm. Full enterprise sublines appear
                  at 1400px+ and in the hero eyebrow at all sizes; they stay
                  hidden at lg/xl to protect the 1024px and 1280px
                  nav transitions from overlap. */}
              <span className="truncate text-[22px] font-medium tracking-tight text-white sm:text-[26px]">
                ATE
              </span>
              <span className="mt-1 hidden truncate text-[10px] font-medium tracking-[0.32em] text-white/60 min-[1400px]:block">
                AKMAL TAUFIK ENTERPRISE
              </span>
              <span className="mt-0.5 hidden truncate text-[9px] font-medium tracking-[0.32em] text-white/40 min-[1400px]:block">
                INFOTECH SOLUTION
              </span>
            </span>
          </a>

          {/* Desktop center nav — 100ms.
              Reference geometry: 52px height, 11px radius,
              rgba(10,7,7,0.35), 17px blur, 24px horizontal padding,
              30px internal gap, 15px/22px/400 white text. */}
          <nav
            aria-label="Primary"
            className="anim anim-fade-down hidden lg:block lg:justify-self-center"
            style={{ animationDelay: '100ms' }}
          >
            <ul className="flex h-[52px] items-center gap-4 rounded-[11px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] px-3 backdrop-blur-[17px] xl:gap-[30px] xl:px-[24px]">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="block whitespace-nowrap rounded-[7px] px-2 py-2 text-[15px] font-normal leading-[22px] text-white transition-colors hover:bg-white/10 xl:px-4"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right zone: grouped actions on desktop, hamburger below lg */}
          <div className="flex items-center justify-end lg:justify-self-end">
            {/* Desktop grouped action area — 200ms.
                Reference: rgba(0,0,0,0.35), 17px blur, 11px radius,
                height corresponding with the 52px navigation. */}
            <div
              className="anim anim-fade-left hidden items-center gap-1 rounded-[11px] border border-white/[0.08] bg-[rgba(0,0,0,0.35)] p-1.5 backdrop-blur-[17px] lg:flex"
              style={{ animationDelay: '200ms' }}
            >
              <a
                href="#login"
                className="whitespace-nowrap rounded-[8px] px-3 py-2.5 text-[13px] font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white xl:px-5 xl:text-[14px]"
              >
                Customer Login
              </a>
              <a
                href="#get-started"
                className="whitespace-nowrap rounded-[8px] bg-[#E9E9E9] px-3 py-2.5 text-[13px] font-semibold text-[#0A0707] transition-colors hover:bg-white xl:px-5 xl:text-[14px]"
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
                className="flex h-[44px] w-[44px] items-center justify-center rounded-[11px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] text-white backdrop-blur-[17px] transition-colors hover:bg-white/10"
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
            className={`mt-3 rounded-[11px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] p-3 backdrop-blur-[30px] transition-all duration-300 ${
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
                    className="block rounded-[8px] px-4 py-3.5 text-[15px] font-normal text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.08] pt-3">
              <a
                href="#login"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="block rounded-[8px] border border-white/10 bg-[rgba(0,0,0,0.35)] px-4 py-3.5 text-center text-[15px] font-medium text-white backdrop-blur-[24px] transition-colors hover:bg-white/10"
              >
                Customer Login
              </a>
              <a
                href="#get-started"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="block rounded-[8px] bg-[#E9E9E9] px-4 py-3.5 text-center text-[15px] font-semibold text-[#0A0707] transition-colors hover:bg-white"
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
