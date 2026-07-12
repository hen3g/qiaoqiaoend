/** Lucide icons (ISC) — https://lucide.dev */

type IconProps = { className?: string; size?: number };

function Svg({
  children,
  className,
  size = 22,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconLayoutGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Svg>
  );
}

export function IconSprout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
      <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
      <path d="M5 21h14" />
    </Svg>
  );
}

export function IconBackpack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M8 10h8" />
      <path d="M8 18h8" />
      <path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
  );
}

export function IconGraduationCap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </Svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function IconMessages(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />
    </Svg>
  );
}

export function IconTags(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z" />
      <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193" />
      <circle cx="10.5" cy="6.5" r=".5" fill="currentColor" />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
      <circle cx="12" cy="13" r="3" />
    </Svg>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </Svg>
  );
}

export function IconBriefcase(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </Svg>
  );
}

const CATEGORY_ICONS: Record<
  string,
  (props: IconProps) => React.ReactElement
> = {
  all: IconLayoutGrid,
  starter: IconSprout,
  primary: IconBackpack,
  junior: IconBookOpen,
  senior: IconGraduationCap,
  scenes: IconMapPin,
  functions: IconMessages,
  nouns: IconTags,
  hobbies: IconCamera,
  exams: IconClipboardCheck,
  pro: IconBriefcase,
};

export function CategoryIcon({
  slug,
  className,
  size = 22,
}: {
  slug: string;
  className?: string;
  size?: number;
}) {
  const Icon = CATEGORY_ICONS[slug] ?? IconLayoutGrid;
  return <Icon className={className} size={size} />;
}

const LEVEL_STYLES: Record<
  number,
  { label: string; bg: string; fg: string }
> = {
  1: { label: "入门", bg: "#e8fff8", fg: "#0f9f82" },
  2: { label: "初级", bg: "#e8f5ff", fg: "#2a7eb8" },
  3: { label: "中级", bg: "#fff4ec", fg: "#d97706" },
  4: { label: "进阶", bg: "#fff0eb", fg: "#c24b1e" },
  5: { label: "高级", bg: "#f3eef8", fg: "#6b4ea0" },
};

export function DifficultyBadge({
  difficulty,
  level,
}: {
  difficulty: number | null;
  level: string | null;
}) {
  const style =
    difficulty != null && LEVEL_STYLES[difficulty]
      ? LEVEL_STYLES[difficulty]
      : level
        ? { label: level, bg: "#eef2f6", fg: "#5a7188" }
        : null;
  if (!style) return null;

  const filled = Math.min(5, Math.max(0, difficulty ?? 0));

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
      title={`难度 ${style.label}${difficulty ? ` · ${difficulty}/5` : ""}`}
    >
      <span>{style.label}</span>
      {filled > 0 ? (
        <span className="inline-flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: i < filled ? style.fg : "rgba(15,36,56,0.15)",
              }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
