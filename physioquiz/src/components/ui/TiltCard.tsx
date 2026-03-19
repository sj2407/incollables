'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useCallback, useRef } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  tiltDeg?: number;
  /** Gentler spring for larger cards */
  gentle?: boolean;
}

export default function TiltCard({
  children,
  className = '',
  style,
  title,
  tiltDeg = 3,
  gentle = false,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springConfig = gentle
    ? { stiffness: 100, damping: 30 }
    : { stiffness: 300, damping: 20 };
  const rotateX = useSpring(useTransform(y, [0, 1], [tiltDeg, -tiltDeg]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-tiltDeg, tiltDeg]), springConfig);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      x.set((e.clientX - rect.left) / rect.width);
      y.set((e.clientY - rect.top) / rect.height);
    },
    [x, y],
  );

  const handlePointerLeave = useCallback(() => {
    x.set(0.5);
    y.set(0.5);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformPerspective: 800,
      }}
      title={title}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.div>
  );
}
