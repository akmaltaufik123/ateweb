import { useState } from 'react';
import { X, Loader2, Search, RefreshCw, AlertCircle, CheckCircle2, Clock, Package } from 'lucide-react';
import type { OrderStatus } from '@/types/smm';
import { checkOrderStatus } from '@/api/smm';

interface Props {
  onClose: () => void;
  initialOrderId?: number;
}

const STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'text-yellow-400/80 bg-yellow-400/[0.08] border-yellow-400/15', icon: <Clock size={12} /> },
  'in progress': { color: 'text-blue-400/80 bg-blue-400/[0.08] border-blue-400/15', icon: <RefreshCw size={12} className="animate-spin" /> },
  completed: { color: 'text-green-400/80 bg-green-400/[0.08] border-green-400/15', icon: <CheckCircle2 size={12} /> },
  partial: { color: 'text-orange-400/80 bg-orange-400/[0.08] border-orange-400/15', icon: <Package size={12} /> },
  cancelled: { color: 'text-red-400/80 bg-red-400/[0.08] border-red-400/15', icon: <AlertCircle size={12} /> },
  error: { color: 'text-red-400/80 bg-red-400/[0.08] border-red-400/15', icon: <AlertCircle size={12} /> },
};

export default function OrderTracker({ onClose, initialOrderId }: Props) {
  const [orderId, setOrderId] = useState(initialOrderId?.toString() ?? '');
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data = await checkOrderStatus(Number(orderId));
      if ((data as { error?: string }).error) {
        setError((data as { error: string }).error);
      } else {
        setStatus(data);
      }
    } catch {
      setError('Failed to check order status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusKey = status?.status?.toLowerCase() ?? '';
  const statusStyle = STATUS_STYLES[statusKey] ?? { color: 'text-white/40 bg-white/[0.04] border-white/[0.06]', icon: <Clock size={12} /> };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[24px] border border-red-500/20 bg-[rgba(17,16,15,0.9)] p-[24px] backdrop-blur-[20px] shadow-2xl sm:rounded-[28px] sm:p-[28px]">
        {/* Red accent line at top */}
        <div className="absolute left-6 right-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-[8px] border border-white/[0.06] bg-white/[0.04] p-1.5 text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <p className="text-[9px] font-semibold tracking-[0.3em] text-white/35">
            ORDER TRACKING
          </p>
          <h3 className="mt-2 text-[15px] font-medium text-white/85">
            Check Your Order Status
          </h3>
        </div>

        {/* Input */}
        <div className="mb-4 flex gap-2">
          <input
            type="number"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter Order ID"
            className="flex-1 rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.15]"
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          />
          <button
            onClick={handleCheck}
            disabled={loading || !orderId.trim()}
            className="flex items-center gap-2 rounded-[9px] border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white/80 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Check
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-red-500/15 bg-red-500/[0.06] px-3 py-2.5 text-[12px] text-red-300/80">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        {/* Status Result */}
        {status && (
          <div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-white/35">STATUS</span>
              <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle.color}`}>
                {statusStyle.icon}
                {status.status}
              </span>
            </div>

            {/* Details */}
            {status.charge && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/35">Charge</span>
                <span className="font-medium text-white/70">
                  {status.charge} {status.currency ?? 'USD'}
                </span>
              </div>
            )}
            {status.start_count && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/35">Start Count</span>
                <span className="font-medium text-white/70">
                  {Number(status.start_count).toLocaleString()}
                </span>
              </div>
            )}
            {status.remains !== undefined && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/35">Remaining</span>
                <span className="font-medium text-white/70">
                  {Number(status.remains).toLocaleString()}
                </span>
              </div>
            )}

            {/* Progress bar */}
            {status.start_count && status.remains !== undefined && (() => {
              const start = Number(status.start_count);
              const remains = Number(status.remains);
              const progress = start > 0 ? ((start - remains) / start) * 100 : 0;
              return (
                <div className="pt-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500/50 to-green-500/50 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[10px] text-white/25">
                    {progress.toFixed(1)}% complete
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
