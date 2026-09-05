/**
 * Authored icon set. One 24px grid, 1.5px stroke, round caps, no fills.
 * Kept small on purpose — an ops console needs six marks, not a library.
 */

type IconProps = {
  size?: number;
  className?: string;
  title?: string;
};

function Svg({ size = 16, className, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconAircraft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c.9 0 1.4 1 1.4 2.4v3.1l7.1 3.9v1.9l-7.1-2.2v3.6l2.3 1.7v1.4L12 18.4l-3.7.4v-1.4l2.3-1.7v-3.6L3.5 14.3v-1.9l7.1-3.9V5.4C10.6 4 11.1 3 12 3Z" />
  </Svg>
);

export const IconStorm = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 16.5a3.75 3.75 0 0 1 .4-7.48A5 5 0 0 1 17 9.3a3.6 3.6 0 0 1 .3 7.2" />
    <path d="m12.6 12-2.4 3.6h2.6L10.8 20" />
  </Svg>
);

export const IconStand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 20V8h10v12" />
    <path d="M7 12h10" />
    <path d="M11 20v-4h2v4" />
  </Svg>
);

export const IconBaggage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="7.5" width="16" height="12" rx="1.5" />
    <path d="M9.5 7.5V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2v2.3" />
    <path d="M9.5 11v5M14.5 11v5" />
  </Svg>
);

export const IconPassengers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="7.5" r="2.8" />
    <path d="M3.8 19.5a5.2 5.2 0 0 1 10.4 0" />
    <path d="M16 5.2a2.8 2.8 0 0 1 0 5.4" />
    <path d="M17.2 13.4a5.2 5.2 0 0 1 3 5.1" />
  </Svg>
);

export const IconRecovery = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" />
    <path d="M20 4.5v4.2h-4.2" />
    <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" />
    <path d="M4 19.5v-4.2h4.2" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const IconCross = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);
