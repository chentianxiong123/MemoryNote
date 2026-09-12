export function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="section-card">
      <div className="section-card__head">
        {eyebrow && <p className="section-card__eyebrow">{eyebrow}</p>}
        <h3 className="section-card__title">{title}</h3>
      </div>
      <div className="section-card__body">{children}</div>
    </article>
  );
}
