export default async function AdminQuestionEditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">Editeur de question</h1>
      <p className="mt-2 text-neutral-500">Question: {id}</p>
      <p className="mt-1 text-neutral-500">Cette page sera implementee au Sprint 5.</p>
    </div>
  );
}
