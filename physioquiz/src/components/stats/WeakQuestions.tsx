'use client';

import Link from 'next/link';
import ScoreCircle from '@/components/ui/ScoreCircle';
import StaggerList from '@/components/ui/StaggerList';

export interface WeakQuestion {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
  topic_id: string;
  avg_score: number;
  attempt_count: number;
}

export function WeakQuestionsSection({ questions }: { questions: WeakQuestion[] }) {
  return (
    <section className="mt-6" aria-labelledby="weak-heading">
      <h2 id="weak-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
        Questions à revoir ({questions.length})
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Score 0 % en priorité, puis par score moyen croissant
      </p>
      <div className="relative mt-3 glass-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-xl bg-gradient-to-b from-neutral-50/90 to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-xl bg-gradient-to-t from-neutral-50/90 to-transparent" aria-hidden="true" />
        <div className="max-h-[230px] overflow-y-auto">
        <StaggerList className="flex flex-col gap-2 p-2" staggerDelay={0.08} duration={0.4}>
          {questions.map((q) => (
            <WeakQuestionCard key={q.question_id} question={q} />
          ))}
        </StaggerList>
        </div>
      </div>
    </section>
  );
}

function WeakQuestionCard({ question }: { question: WeakQuestion }) {
  return (
    <div className="glass-card-inner border-l-4 border-l-error p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-700">
            {question.question_number ? `Q${question.question_number}. ` : ''}
            {question.question_text}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <Link
              href={`/quiz/setup/${question.topic_id}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {question.topic_title}
            </Link>
            <span>· {question.attempt_count} session{question.attempt_count > 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="shrink-0">
          <ScoreCircle score={question.avg_score} size={40} strokeWidth={2.5} fontSize={11} />
        </div>
      </div>
    </div>
  );
}
