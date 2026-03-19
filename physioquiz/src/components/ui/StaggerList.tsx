'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';

interface StaggerListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  duration?: number;
  className?: string;
}

export default function StaggerList({
  children,
  staggerDelay = 0.12,
  duration = 0.5,
  className = '',
}: StaggerListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.05 });

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.97 }}
          transition={{
            duration,
            delay: i * staggerDelay,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
