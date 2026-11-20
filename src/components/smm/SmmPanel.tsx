import { useEffect, useMemo, useState } from 'react';
import {
  Instagram,
  Music2,
  Facebook,
  Youtube,
  Twitter,
  Send,
  Camera,
  Music,
  AtSign,
  Globe,
  Loader2,
  Search,
  ShoppingCart,
  AlertCircle,
  Package,
} from 'lucide-react';
import type { SmmService } from '@/types/smm';
import { fetchServices } from '@/api/smm';
import { PLATFORMS, groupByPlatform } from '@/utils/platforms';
import { formatPrice } from '@/utils/currency';
import OrderModal from '@/components/smm/OrderModal';
import OrderTracker from '@/components/smm/OrderTracker';

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={16} />,
  tiktok: <Music2 size={16} />,
  facebook: <Facebook size={16} />,
  youtube: <Youtube size={16} />,
  twitter: <Twitter size={16} />,
  telegram: <Send size={16} />,
  snapchat: <Camera size={16} />,
  spotify: <Music size={16} />,
  threads: <AtSign size={16} />,
  other: <Globe size={16} />,
};

export default function SmmPanel() {
  const [services, setServices] = useState<SmmService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>('instagram');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<SmmService | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchServices();
        if (!cancelled) {
          setServices(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load services. Please try again later.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => groupByPlatform(services), [services]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PLATFORMS) {
      counts[p.key] = grouped[p.key]?.length ?? 0;
    }
    return counts;
  }, [grouped]);

  const filteredServices = useMemo(() => {
    const list = grouped[activePlatform] ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [grouped, activePlatform, searchQuery]);


  if (loading) {
    return (
      <section id="smm-panel" className="relative bg-[#080A19] py-24">
        <div className="mx-auto flex max-w-[1800px] items-center justify-center px-5 py-32">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          <span className="ml-3 text-[13px] text-white/40">Loading services...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="smm-panel" className="relative bg-[#080A19] py-24">
        <div className="mx-auto max-w-[1800px] px-5 py-32 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400/70" />
          <p className="mt-4 text-[14px] text-white/50">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="smm-panel" className="relative bg-[#080A19] py-20">
      {/* Background image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: 'url(/bg-digital.png)' }}
      />
      {/* Dark overlay for readability */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#080A19]/80"
      />
      {/* Atmospheric background — matching Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 480px at 18% 30%, rgba(64,86,178,0.12), transparent 60%), radial-gradient(820px 520px at 82% 62%, rgba(38,52,120,0.14), transparent 62%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#080A19] to-transparent"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-[20px] sm:px-[32px] md:px-[82px]">
        {/* Header — matching Hero typography */}
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold tracking-[0.34em] text-white/55">
            SOCIAL MEDIA BOOSTING
          </p>
          <p className="mt-1.5 text-[11px] font-medium tracking-[0.34em] text-white/35">
            POWERED BY ATEBOOSTER
          </p>
          <h2 className="mt-5 font-normal tracking-[-0.02em] text-white text-[32px] sm:text-[44px] md:text-[52px]">
            SMM Panel
          </h2>
          <p className="mx-auto mt-4 max-w-[420px] text-[15px] text-white/55 sm:text-[17px]" style={{ lineHeight: '1.55' }}>
            Boost your social media presence with premium services. Select a platform to browse packages.
          </p>
        </div>

        {/* Platform Tabs — matching Navbar pill style */}
        <div className="mb-8 flex justify-center">
          <nav className="flex flex-wrap items-center gap-1.5 rounded-[11px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] p-1.5 backdrop-blur-[17px] sm:gap-2 sm:p-2">
            {PLATFORMS.map((p) => {
              const count = platformCounts[p.key];
              if (count === 0) return null;
              const isActive = activePlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => { setActivePlatform(p.key); setSearchQuery(''); }}
                  className={`flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] font-medium transition-all sm:px-3.5 sm:text-[13px] ${
                    isActive
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/45 hover:bg-white/[0.06] hover:text-white/65'
                  }`}
                >
                  {PLATFORM_ICONS[p.key]}
                  <span className="hidden sm:inline">{p.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    isActive ? 'bg-white/15 text-white/80' : 'bg-white/[0.04] text-white/30'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Search + Actions */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[10px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] py-2.5 pl-10 pr-4 text-[13px] text-white placeholder:text-white/25 outline-none backdrop-blur-[17px] transition-colors focus:border-white/[0.15]"
            />
          </div>
          <button
            onClick={() => setShowTracker(true)}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] bg-[rgba(10,7,7,0.35)] px-4 py-2.5 text-[12px] font-medium text-white/55 backdrop-blur-[17px] transition-colors hover:bg-white/[0.06] hover:text-white/75"
          >
            <Package size={14} />
            Track Order
          </button>
        </div>

        {/* Active platform label */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-white/40">
            {PLATFORMS.find(p => p.key === activePlatform)?.label?.toUpperCase()}
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[11px] text-white/30">
            {filteredServices.length} services
          </span>
        </div>

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] text-white/35">No services found matching your search.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredServices.map((svc) => (
              <ServiceCard
                key={svc.service}
                service={svc}
                onSelect={() => setSelectedService(svc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order Modal */}
      {selectedService && (
        <OrderModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}

      {/* Order Tracker Modal */}
      {showTracker && (
        <OrderTracker
          onClose={() => setShowTracker(false)}
        />
      )}


    </section>
  );
}

/* ---------- Service Card — matching GatewayCard style ---------- */

function ServiceCard({ service, onSelect }: { service: SmmService; onSelect: () => void }) {
  const rate = parseFloat(service.rate);
  const price = formatPrice(rate);

  return (
    <div className="group relative rounded-[16px] border border-red-500/20 bg-[rgba(17,16,15,0.35)] p-[16px] backdrop-blur-[20px] transition-all hover:border-red-500/40 hover:bg-[rgba(17,16,15,0.5)] sm:rounded-[20px] sm:p-[20px]">
      {/* Red accent line at top */}
      <div className="absolute left-4 right-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-tight text-white/80">
          {service.name}
        </h3>
        {service.refill && (
          <span className="shrink-0 rounded-full border border-green-500/20 bg-green-500/[0.08] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-green-400/80">
            REFILL
          </span>
        )}
      </div>

      {/* Price — MYR primary, USD secondary */}
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tracking-tight text-white">
          {price.myr}
        </span>
        <span className="text-[11px] text-white/30">/ 1000</span>
        <span className="ml-auto text-[11px] text-white/25">
          {price.usd}
        </span>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-1.5">
        <div className="rounded-[7px] border border-white/[0.05] bg-white/[0.03] px-2.5 py-2">
          <span className="block text-[9px] font-medium tracking-wider text-white/30">MIN</span>
          <span className="text-[12px] font-medium text-white/70">{service.min.toLocaleString()}</span>
        </div>
        <div className="rounded-[7px] border border-white/[0.05] bg-white/[0.03] px-2.5 py-2">
          <span className="block text-[9px] font-medium tracking-wider text-white/30">MAX</span>
          <span className="text-[12px] font-medium text-white/70">{service.max.toLocaleString()}</span>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onSelect}
        className="flex w-full items-center justify-center gap-2 rounded-[9px] border border-white/[0.08] bg-white/[0.05] py-2.5 text-[12px] font-medium text-white/60 transition-all group-hover:border-white/[0.12] group-hover:bg-white/[0.08] group-hover:text-white/85"
      >
        <ShoppingCart size={12} />
        Select Package
      </button>
    </div>
  );
}
