type VipBadgeProps = {
  className?: string;
  size?: number;
};

/** Geometric VIP mark — no emoji. */
export function VipBadge({ className = "", size = 18 }: VipBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 2.5L14.6 8.2L20.8 8.9L16.2 13.1L17.5 19.2L12 16.2L6.5 19.2L7.8 13.1L3.2 8.9L9.4 8.2L12 2.5Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1L11 13.9L14.9 9.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VipShield({ className = "", size = 18 }: VipBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 3.2L19 6.2V11.4C19 15.8 16.2 19.6 12 20.8C7.8 19.6 5 15.8 5 11.4V6.2L12 3.2Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 12L11.1 14L15.1 9.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
