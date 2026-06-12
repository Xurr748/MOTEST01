"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function FloatingShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  color = "var(--primary)",
  opacity = 0.07,
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -80, rotate: rotate - 10 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96] as const,
        opacity: { duration: 1.5 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{
          duration: 14,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{ width, height }}
        className="relative"
      >
        <div
          style={{
            background: `linear-gradient(to right, ${color}, transparent)`,
            opacity,
          }}
          className="absolute inset-0 rounded-full blur-sm"
        />
      </motion.div>
    </motion.div>
  );
}

export function FloatingBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <FloatingShape
        delay={0.2}
        width={500}
        height={140}
        rotate={12}
        color="var(--primary)"
        opacity={0.10}
        className="left-[-12%] top-[8%]"
      />
      <FloatingShape
        delay={0.6}
        width={420}
        height={110}
        rotate={-15}
        color="var(--chart-2)"
        opacity={0.12}
        className="right-[-6%] top-[60%]"
      />
      <FloatingShape
        delay={0.4}
        width={300}
        height={80}
        rotate={-8}
        color="var(--chart-1)"
        opacity={0.08}
        className="left-[5%] bottom-[5%]"
      />
      <FloatingShape
        delay={0.8}
        width={200}
        height={60}
        rotate={22}
        color="var(--secondary)"
        opacity={0.15}
        className="right-[15%] top-[5%]"
      />
      <FloatingShape
        delay={1.0}
        width={160}
        height={45}
        rotate={-20}
        color="var(--primary)"
        opacity={0.06}
        className="left-[30%] top-[40%]"
      />
    </div>
  );
}
