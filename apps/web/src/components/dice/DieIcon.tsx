import type { SVGProps } from "react";

/**
 * Minimal polyhedral silhouettes for each die type.
 * Drawn on a 24x24 grid with currentColor strokes.
 */
const SHAPES: Record<number, React.ReactNode> = {
  4: (
    <>
      <path d="M12 3 21.5 19.5H2.5Z" />
      <path d="M12 3v16.5M2.5 19.5 12 13l9.5 6.5" opacity={0.45} />
    </>
  ),
  6: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  8: (
    <>
      <path d="M12 2.5 21 12l-9 9.5L3 12Z" />
      <path d="M3 12h18M12 2.5 8 12l4 9.5 4-9.5Z" opacity={0.45} />
    </>
  ),
  10: (
    <>
      <path d="M12 2.5 21 10l-9 11.5L3 10Z" />
      <path d="M3 10l9 3.5 9-3.5M12 13.5v8M12 2.5 8.5 11.5M12 2.5l3.5 9" opacity={0.45} />
    </>
  ),
  12: (
    <>
      <path d="M12 2.5 21 9l-3.4 10.5H6.4L3 9Z" />
      <path d="M12 6.5 16.5 10l-1.7 5.2H9.2L7.5 10Z" opacity={0.45} />
    </>
  ),
  20: (
    <>
      <path d="M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5Z" />
      <path d="M12 7.5 16.5 15h-9ZM12 2.5v5M3.5 7.25 7.5 15M20.5 7.25 16.5 15M7.5 15 12 21.5 16.5 15M3.5 16.75 7.5 15M20.5 16.75 16.5 15" opacity={0.45} />
    </>
  ),
  100: (
    <>
      <path d="M8 4 13.5 8.5 8 20 2.5 8.5Z" />
      <path d="M16 4 21.5 8.5 16 20 10.5 8.5Z" opacity={0.7} />
    </>
  ),
};

interface DieIconProps extends SVGProps<SVGSVGElement> {
  sides: number;
}

export function DieIcon({ sides, ...props }: DieIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      {SHAPES[sides] ?? SHAPES[20]}
    </svg>
  );
}
