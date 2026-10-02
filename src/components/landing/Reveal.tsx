import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Quiet fade-and-rise used throughout the marketing page. */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 16,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Numbered micro caption that anchors every section. */
export function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="micro tnum font-mono">{index}</span>
      <span aria-hidden className="h-px w-6 bg-border" />
      <span className="micro">{label}</span>
    </div>
  );
}
