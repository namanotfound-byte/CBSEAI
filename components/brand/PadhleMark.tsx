export function PadhleMark({ size = 42, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Padhle logo" className={className}>
      <rect width="48" height="48" rx="13" fill="#111827" />
      <path d="M24 15.5c-4.6-3.2-9.4-3.7-14-1.3v17c4.8-2.3 9.4-1.8 14 1.4 4.6-3.2 9.2-3.7 14-1.4v-17c-4.6-2.4-9.4-1.9-14 1.3Z" stroke="white" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M24 15.5v17" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <path d="m32 7 .7 2.3L35 10l-2.3.7L32 13l-.7-2.3L29 10l2.3-.7L32 7Z" fill="#A5B4FC" />
    </svg>
  );
}
