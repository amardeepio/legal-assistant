/** Scales-of-justice mark used for the brand and the assistant avatar. */
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3v17" />
      <path d="M8 20h8" />
      <path d="M4 7h16" />
      <circle cx="12" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M6 7 3 13.5a3 3 0 0 0 6 0Z" />
      <path d="M18 7l-3 6.5a3 3 0 0 0 6 0Z" />
    </svg>
  );
}
