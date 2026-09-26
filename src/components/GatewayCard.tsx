const BAR_HEIGHTS = [
  23, 40, 53, 40, 33, 14, 7, 17,
  75, 65, 88, 75, 65, 47, 33, 88,
  4, 7, 9, 14, 95, 65, 79, 37,
  7, 40, 17, 20, 62, 47, 92, 72,
];

const MAX_HEIGHT = Math.max(...BAR_HEIGHTS);

const AXIS_LABELS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

export default function GatewayCard() {
  return (
    <div
      className="anim anim-fade-scale w-full max-w-[405px] rounded-[24px] border border-white/[0.08] bg-[rgba(17,16,15,0.35)] p-[20px] backdrop-blur-[20px] sm:rounded-[33px] sm:px-[32px] sm:pb-[24px] sm:pt-[32px]"
      style={{ animationDelay: '900ms' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.18em] text-white">
            ATEGateway
          </p>
          <p className="mt-1.5 text-[15px] font-medium text-white/70">
            AI API Infrastructure
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-white/80">
          DEVELOPMENT
        </span>
      </div>

      <p className="mt-4 max-w-[340px] text-[13.5px] leading-relaxed text-white/60">
        Centralized access for AI API management, usage visibility and
        developer infrastructure.
      </p>

      {/* Decorative illustrative chart — not real customer data */}
      <div className="mt-6">
        <div
          role="img"
          aria-label="Illustrative API activity visualization, not real customer data"
          className="flex h-[80px] items-end sm:h-[100px]"
          style={{ gap: '1.5px' }}
        >
          {BAR_HEIGHTS.map((h, index) => {
            const isDimmed = index >= BAR_HEIGHTS.length - 4;
            return (
              <div
                key={index}
                aria-hidden="true"
                className={`anim-bar flex-1 ${
                  isDimmed ? 'bg-white/15' : 'bg-white/70'
                }`}
                style={{
                  height: `${(h / MAX_HEIGHT) * 100}%`,
                  borderRadius: '0.5px',
                  animationDelay: `${1100 + index * 30}ms`,
                }}
              />
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="mt-2.5 flex items-center justify-between text-[10px] font-medium tracking-[0.14em] text-white/35"
        >
          {AXIS_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <p className="sr-only">
          Illustrative visualization only. Does not represent actual customer
          data.
        </p>
      </div>
    </div>
  );
}
