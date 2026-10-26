import type { ReactNode } from "react";

/**
 * Stroke is divided by render scale so every icon gets the same 1.5px line.
 */
const STROKE_PX = 1.5;
const GRID = 24;

type IconProps = {
  size?: number;
  /** Omit for decorative icons next to a visible label. */
  title?: string;
  className?: string;
};

function Icon({
  size = GRID,
  title,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={(STROKE_PX * GRID) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
      <path d="M3 16l5-5c.9-.9 2.1-.9 3 0l5 5M14 14l1-1c.9-.9 2.1-.9 3 0l3 3" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Icon>
  );
}

export function GripIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </Icon>
  );
}

export function OpenerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v14H4zM8 10h8M10 14h4" />
    </Icon>
  );
}

export function QaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v11h-9l-4 4v-4H4zM8 9h8M8 12h5" />
    </Icon>
  );
}

export function VoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13h18v7H3zM8 13V4h8v9M10.5 8.5l1 1 2-2.5" />
    </Icon>
  );
}

export function DieIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h16v16H4z" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="2.5" />
    </Icon>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19h16M5 16L3.5 7l5 4L12 5l3.5 6 5-4L19 16z" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l7.5 3v5.5c0 4.7-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.8-7.5-9.5V6z" />
    </Icon>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" />
    </Icon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM11.5 12.5L4 20M6.5 17.5l2.5 2.5M4.5 19.5l1.5 1.5M15 8.5h.01" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
    </Icon>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.3-2.3 3.5M6.4 6.4C4.5 7.7 3.1 9.7 2.5 12c1 2.5 4.5 7 9.5 7 1.9 0 3.6-.6 5-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 15v4h16v-4M12 15V4M7.5 8.5L12 4l4.5 4.5" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
    </Icon>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 11h4v6H5v-6zm0 0c0-3 1-5 4-6M14 11h4v6h-4v-6zm0 0c0-3 1-5 4-6" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5v13l10.5-6.5z" />
    </Icon>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 9h11v11H9zM15 9V4H4v11h5" />
    </Icon>
  );
}

export function ReleaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 20c1-3.6 3.6-5.5 7-5.5 1.6 0 3 .4 4.2 1.2M16 18h6" />
    </Icon>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v11H10l-6 4z" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  );
}

export function TimerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9.5V13l2.5 1.5M10 3h4" />
    </Icon>
  );
}

export function MusicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </Icon>
  );
}

export function SoundIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" />
    </Icon>
  );
}

export function MusicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}
