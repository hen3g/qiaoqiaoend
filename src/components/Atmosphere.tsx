export function Atmosphere({ tall = false }: { tall?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${tall ? "h-[90vh]" : "h-[48vh]"}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at 12% -8%, rgba(43,109,232,0.2) 0%, transparent 58%), radial-gradient(ellipse 42% 38% at 92% 8%, rgba(14,165,233,0.14) 0%, transparent 52%), radial-gradient(ellipse 50% 35% at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 55%), linear-gradient(180deg, #e4ecf7 0%, var(--bg) 78%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(43,109,232,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(43,109,232,0.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, transparent 85%)",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, transparent 85%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(43,109,232,0.22) 0.7px, transparent 0.7px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 10%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 50% 10%, black 0%, transparent 70%)",
        }}
      />
      <div className="absolute left-1/2 top-0 h-px w-[min(72%,42rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
    </div>
  );
}
