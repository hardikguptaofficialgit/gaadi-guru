"use client";
import { motion } from "framer-motion";
// Re-mounts on every route change -> one consistent page transition.
export default function T({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, ease: [.2, .8, .2, 1] }}>{children}</motion.div>;
}
