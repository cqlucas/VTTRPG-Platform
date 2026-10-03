// @questdreamer/ui — Shared React Components
// This package will house reusable components built with Tailwind CSS and shadcn/ui

export function QuestDreamerLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold text-xl tracking-tight ${className ?? ""}`}>
      Quest<span className="text-purple-500">Dreamer</span>
    </span>
  );
}
