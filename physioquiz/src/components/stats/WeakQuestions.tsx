'use client';

export interface WeakQuestion {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
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
      <div className="mt-3 max-h-[400px] overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/50">
        <div className="flex flex-col gap-2 p-2">
          {questions.map((q) => (
            <WeakQuestionCard key={q.question_id} question={q} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WeakQuestionCard({ question }: { question: WeakQuestion }) {
  const scoreColor =
    question.avg_score >= 40
      ? 'text-warning'
      : 'text-error';

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-700">
            {question.question_number ? `Q${question.question_number}. ` : ''}
            {question.question_text}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {question.topic_title} · {question.attempt_count} session{question.attempt_count > 1 ? 's' : ''}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>
          {question.avg_score}%
        </span>
      </div>
    </div>
  );
}
