"use client";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
// Re-mounts on every route change -> one consistent page transition. Honors prefers-reduced-motion everywhere.
export default function T({ children }: { children: React.ReactNode }) {
  const still = useReducedMotion();
  return <MotionConfig reducedMotion="user"><motion.div initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .28, ease: [.2, .8, .2, 1] }}>{children}</motion.div></MotionConfig>;
}
