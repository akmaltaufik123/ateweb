import { useState } from 'react';
import { X, AlertCircle, ShoppingCart } from 'lucide-react';
import type { SmmService } from '@/types/smm';
import { formatPrice } from '@/utils/currency';

interface Props {
  service: SmmService;
  onClose: () => void;
}

export default function OrderModal({ service, onClose }: Props) {
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(service.min);
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rate = parseFloat(service.rate);
  const totalCost = formatPrice((rate * quantity) / 1000);
  const ratePrice = formatPrice(rate);
  const needsComments = service.type.toLowerCase().includes('custom comment');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!link.trim()) {
      setError('Please enter a valid link.');
      return;
    }
    if (quantity < service.min || quantity > service.max) {
      setError(`Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}.`);
      return;
    }
    if (needsComments && !comments.trim()) {
      setError('Please enter comments for this service.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service: service.service, link: link.trim(), quantity, comments }) });
      if (!res.ok) throw new Error('Tempahan tidak dapat direkodkan. Cuba lagi.');
      const data: { whatsappUrl: string } = await res.json();
      window.location.href = data.whatsappUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ralat tempahan');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — matching GatewayCard style */}
      <div className="relative w-full max-w-md rounded-[24px] border border-red-500/20 bg-[rgba(17,16,15,0.9)] p-[24px] backdrop-blur-[20px] shadow-2xl sm:rounded-[28px] sm:p-[28px]">
        {/* Red accent line at top */}
        <div className="absolute left-6 right-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-[8px] border border-white/[0.06] bg-white/[0.04] p-1.5 text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <p className="text-[9px] font-semibold tracking-[0.3em] text-white/35">
            NEW ORDER
          </p>
          <h3 className="mt-2 text-[15px] font-medium leading-snug text-white/85">
            {service.name}
          </h3>
          <p className="mt-1 text-[11px] text-white/35">
            Service ID: {service.service} &middot; {service.type}
          </p>
        </div>

        {/* Price info card */}
        <div className="mb-5 rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-white/35">Rate per 1000</span>
            <div className="text-right">
              <span className="font-medium text-white/75">{ratePrice.myr}</span>
              <span className="ml-1.5 text-[10px] text-white/25">{ratePrice.usd}</span>
            </div>
          </div>
          <div className="my-2 h-px bg-white/[0.05]" />
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-white/35">Estimated total</span>
            <div className="text-right">
              <span className="text-[18px] font-semibold text-white">{totalCost.myr}</span>
              <span className="ml-1.5 text-[11px] text-white/25">{totalCost.usd}</span>
            </div>
          </div>
        </div>

        <p className="mb-4 text-[12px] text-white/60">Tempahan akan dihantar ke WhatsApp Business. Harga akhir dan bayaran disahkan secara manual; tiada pesanan upstream dibuat secara automatik.</p>
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Link */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-white/40">
              LINK
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://instagram.com/username"
              className="w-full rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.15]"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-white/40">
              QUANTITY
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={service.min}
              max={service.max}
              className="w-full rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none transition-colors focus:border-white/[0.15]"
              required
            />
            <p className="mt-1 text-[10px] text-white/25">
              Min: {service.min.toLocaleString()} &middot; Max: {service.max.toLocaleString()}
            </p>
            {/* Quick select buttons */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                { label: 'Min', val: service.min },
                { label: '1K', val: Math.min(1000, service.max) },
                { label: '5K', val: Math.min(5000, service.max) },
                { label: '10K', val: Math.min(10000, service.max) },
                { label: '50K', val: Math.min(50000, service.max) },
              ].filter(b => b.val >= service.min && b.val <= service.max && b.val !== quantity).slice(0, 4).map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => setQuantity(btn.val)}
                  className="rounded-[7px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments (for custom comment services) */}
          {needsComments && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-white/40">
                COMMENTS
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Great post!&#10;Amazing content!&#10;Love this!"
                rows={3}
                className="w-full resize-none rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.15]"
                required
              />
              <p className="mt-1 text-[10px] text-white/25">One comment per line</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-[8px] border border-red-500/15 bg-red-500/[0.06] px-3 py-2.5 text-[12px] text-red-300/80">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {/* Submit — matching primary button style */}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#E9E9E9] py-3 text-[13px] font-semibold text-[#0A0707] transition-colors hover:bg-white disabled:opacity-50"
          >
            <><ShoppingCart size={14} /> {submitting ? "Merekod tempahan..." : "Tempah melalui WhatsApp — " + totalCost.myr}</>
          </button>
        </form>
      </div>
    </div>
  );
}
