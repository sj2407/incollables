'use client';

import { CaretRight } from '@phosphor-icons/react';
import type { TopicWithCount } from '@/hooks/useTopics';
import { getTotalQuestionCount } from '@/hooks/useTopics';
import Link from 'next/link';
import { useState } from 'react';

interface TopicTreeProps {
  topics: TopicWithCount[];
}

export default function TopicTree({ topics }: TopicTreeProps) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Aucun cours disponible.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {topics.map((topic) => (
        <TopicNode key={topic.id} topic={topic} depth={0} />
      ))}
    </div>
  );
}

interface TopicNodeProps {
  topic: TopicWithCount;
  depth: number;
}

function TopicNode({ topic, depth }: TopicNodeProps) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const hasChildren = topic.children.length > 0;
  const totalQuestions = getTotalQuestionCount(topic);

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-md transition-colors hover:border-primary-200 hover:bg-primary-50 sm:p-4 ${
          depth > 0 ? 'ml-4 sm:ml-6' : ''
        }`}
      >
        {/* Expand/collapse button for nodes with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Replier' : 'Déplier'}
            aria-expanded={isOpen}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <CaretRight
              size={16}
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="w-11 shrink-0" />
        )}

        {/* Topic link */}
        <Link
          href={totalQuestions > 0 ? `/quiz/setup/${topic.id}` : '#'}
          aria-disabled={totalQuestions === 0}
          className={`flex min-h-[44px] flex-1 items-center gap-3 ${
            totalQuestions === 0 ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <div className="flex-1">
            <span
              className={`font-semibold text-neutral-900 ${
                depth === 0 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
              }`}
            >
              {topic.title}
            </span>
          </div>

          {/* Question count badge */}
          <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary">
            {totalQuestions} {totalQuestions <= 1 ? 'question' : 'questions'}
          </span>
        </Link>
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <div className="mt-2 flex flex-col gap-2">
          {topic.children.map((child) => (
            <TopicNode key={child.id} topic={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
