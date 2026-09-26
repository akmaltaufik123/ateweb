import GatewayCard from '@/components/GatewayCard';

export default function Hero() {
  return (
    <section
      aria-label="Akmal Taufik Enterprise introduction"
      className="relative flex w-full items-center overflow-hidden bg-[#080A19] lg:h-screen"
      style={{ minHeight: '100svh' }}
    >
      {/* Atmospheric background fallback (#080A19).
          No public Apogee reference video URL was supplied with this task,
          so the graceful solid + gradient fallback is retained rather than
          swapping in unrelated media. If a licensed URL is provided later,
          render it here as an absolute full-screen object-cover video with
          autoplay + loop + muted + playsInline beneath the content. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#080A19]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 480px at 18% 30%, rgba(64,86,178,0.20), transparent 60%), radial-gradient(820px 520px at 82% 62%, rgba(38,52,120,0.22), transparent 62%), radial-gradient(600px 380px at 55% 105%, rgba(20,28,80,0.28), transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080A19] to-transparent"
      />

      {/* Content — max 1800px, padding 20 / 32 / 82 */}
      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-[20px] pb-16 pt-32 sm:px-[32px] md:px-[82px] lg:py-0">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-[48px]">
          {/* Left: hero copy, max 593px */}
          <div className="w-full max-w-[593px] text-left">
            <p
              className="anim anim-fade-up text-[11px] font-semibold tracking-[0.34em] text-white/55 sm:text-xs"
              style={{ animationDelay: '300ms' }}
            >
              AKMAL TAUFIK ENTERPRISE
            </p>
            <p
              className="anim anim-fade-up mt-2 text-[11px] font-medium tracking-[0.34em] text-white/35 sm:text-xs"
              style={{ animationDelay: '320ms' }}
            >
              INFOTECH SOLUTION
            </p>

            <h1
              className="anim anim-fade-up mt-6 font-normal tracking-[-0.02em] text-white text-[36px] sm:text-[52px] md:text-[64px] lg:text-[72px]"
              style={{ animationDelay: '300ms', lineHeight: '0.95' }}
            >
              Powering Your Digital Infrastructure
            </h1>

            <p
              className="anim anim-fade-up mt-6 max-w-[370px] text-[16px] text-white/65 sm:text-[18px] md:text-[20px]"
              style={{ animationDelay: '500ms', lineHeight: '1.55' }}
            >
              AI infrastructure, cybersecurity and IT solutions built for
              developers, businesses and the next generation of digital
              operations.
            </p>

            <div
              className="anim anim-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: '700ms' }}
            >
              <a
                href="#solutions"
                className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-[12px] bg-[#E9E9E9] px-[20px] text-[14px] font-semibold text-[#0A0707] transition-colors hover:bg-white sm:h-[51px] sm:px-[27px] sm:text-[15.5px]"
              >
                Explore Our Solutions
              </a>
              <a
                href="#contact"
                className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-[12px] border border-white bg-white/5 px-[20px] text-[14px] font-medium text-white backdrop-blur-[17px] transition-colors hover:bg-white/15 sm:h-[51px] sm:px-[27px] sm:text-[15.5px]"
              >
                Talk With Us
              </a>
            </div>
          </div>

          {/* Right: ATEGateway card, max 405px, centered on mobile, right-aligned on lg */}
          <div className="flex w-full justify-center lg:w-auto lg:flex-shrink-0 lg:justify-end">
            <GatewayCard />
          </div>
        </div>
      </div>
    </section>
  );
}
