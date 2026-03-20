'use client';

import { motion } from 'motion/react';

interface PillOption {
  key: string;
  label: string;
}

interface PillToggleProps {
  options: PillOption[];
  active: string;
  onChange: (key: string) => void;
}

export default function PillToggle({ options, active, onChange }: PillToggleProps) {
  const activeIndex = options.findIndex((o) => o.key === active);

  return (
    <div className="relative inline-grid rounded-full bg-white/40 backdrop-blur-sm border border-white/40 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {/* Sliding pill */}
      <motion.div
        className="absolute inset-y-1 rounded-full bg-primary shadow-md"
        initial={false}
        animate={{
          x: `${activeIndex * 100}%`,
          width: `${100 / options.length}%`,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ left: 0 }}
        layout
      />
      {/* Buttons */}
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`relative z-10 rounded-full px-4 py-1.5 text-center text-xs font-medium transition-colors duration-200 ${
            active === option.key
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
