export default function LearnPage() {
  const placeholders = [
    { title: 'Résumés de cours', icon: '📝' },
    { title: 'Vidéos', icon: '🎥' },
    { title: 'Fiches de révision', icon: '📋' },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        Apprendre
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Contenus pédagogiques pour accompagner vos révisions.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {placeholders.map((item) => (
          <div
            key={item.title}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center"
          >
            <span className="text-3xl">{item.icon}</span>
            <p className="mt-3 text-sm font-semibold text-neutral-700">{item.title}</p>
            <p className="mt-1 text-xs text-neutral-400">Bientôt disponible</p>
          </div>
        ))}
      </div>
    </div>
  );
}
