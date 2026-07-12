export function Atmosphere({ tall = false }: { tall?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 ${tall ? "h-[85vh]" : "h-[45vh]"}`}
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 15% -5%, rgba(43,109,232,0.14) 0%, transparent 55%), radial-gradient(ellipse 45% 40% at 95% 10%, rgba(232,137,58,0.1) 0%, transparent 50%), linear-gradient(180deg, #e9eef5 0%, var(--bg) 75%)",
      }}
    />
  );
}
