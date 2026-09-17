"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Fade-in + slide-up wrapper for cards/sections. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Staggered list item reveal. */
export function StaggerItem({
  children,
  index,
  className,
}: {
  children: ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.05, 0.4),
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated number ticker for IPK/delta values. */
export function AnimatedNumber({
  value,
  format = (v: number) => v.toFixed(3),
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      {format(value)}
    </motion.span>
  );
}

/** Pulse glow for the "best scenario" highlight. */
export function PulseGlow({
  children,
  active = true,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  if (!active) return <>{children}</>;
  return (
    <motion.div
      initial={{ boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" }}
      animate={{
        boxShadow: [
          "0 0 0 0 rgba(16, 185, 129, 0.15)",
          "0 0 0 6px rgba(16, 185, 129, 0)",
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
