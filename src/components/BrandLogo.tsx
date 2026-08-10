import Image from "next/image";

const sizes = {
  header: { width: 152, height: 45, className: "h-9 w-auto sm:h-10" },
  footer: { width: 128, height: 38, className: "h-8 w-auto" },
  aside: { width: 160, height: 47, className: "h-10 w-auto" },
  hero: {
    width: 380,
    height: 112,
    className: "h-14 w-auto sm:h-[4.5rem] lg:h-20",
  },
} as const;

type BrandLogoSize = keyof typeof sizes;

export function BrandLogo({
  size = "header",
  priority = false,
  className = "",
}: {
  size?: BrandLogoSize;
  priority?: boolean;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <Image
      src="/logo.png"
      alt="敲敲英语"
      width={s.width}
      height={s.height}
      priority={priority}
      className={`${s.className} ${className}`.trim()}
    />
  );
}
