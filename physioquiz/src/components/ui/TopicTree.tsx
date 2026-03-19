'use client';

import { CaretRight } from '@phosphor-icons/react';
import type { TopicWithCount } from '@/hooks/useTopics';
import { getTotalQuestionCount } from '@/hooks/useTopics';
import Link from 'next/link';
import { useState } from 'react';
import StaggerList from '@/components/ui/StaggerList';

interface TopicTreeProps {
  topics: TopicWithCount[];
}

export default function TopicTree({ topics }: TopicTreeProps) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Aucun cours disponible.</p>
    );
  }

  const filtered = topics.filter((t) => getTotalQuestionCount(t) > 0);

  return (
    <StaggerList className="flex flex-col gap-2" staggerDelay={0.08} duration={0.4}>
      {filtered.map((topic) => (
        <TopicNode key={topic.id} topic={topic} depth={0} />
      ))}
    </StaggerList>
  );
}

interface TopicNodeProps {
  topic: TopicWithCount;
  depth: number;
}

function TopicNode({ topic, depth }: TopicNodeProps) {
  // A: Collapse by default
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = topic.children.length > 0;
  const totalQuestions = getTotalQuestionCount(topic);

  const isChapter = depth === 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl transition-colors hover:border-primary-200 hover:bg-primary-50 ${
          isChapter
            ? 'glass-card p-1 sm:p-1.5'
            : 'ml-4 glass-card-inner p-1 sm:ml-6 sm:p-1.5'
        }`}
      >
        {/* Expand/collapse button for nodes with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Replier' : 'Déplier'}
            aria-expanded={isOpen}
            className={`flex shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 ${
              isChapter ? 'min-h-[44px] min-w-[44px]' : 'min-h-[36px] min-w-[36px]'
            }`}
          >
            <CaretRight
              size={isChapter ? 16 : 14}
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className={isChapter ? 'w-11 shrink-0' : 'w-9 shrink-0'} />
        )}

        {/* Topic link */}
        <Link
          href={totalQuestions > 0 ? `/quiz/setup/${topic.id}` : '#'}
          aria-disabled={totalQuestions === 0}
          className={`flex flex-1 items-center gap-3 ${
            isChapter ? 'min-h-[44px]' : 'min-h-[36px]'
          } ${totalQuestions === 0 ? 'pointer-events-none opacity-50' : ''}`}
        >
          <div className="flex-1">
            <span
              className={`text-neutral-900 ${
                isChapter ? 'text-sm font-semibold sm:text-base' : 'text-sm font-medium sm:text-base'
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
      {hasChildren && (
        <div
          className="mt-1.5 grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1.5">
              {topic.children.filter((c) => getTotalQuestionCount(c) > 0).map((child) => (
                <TopicNode key={child.id} topic={child} depth={depth + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
