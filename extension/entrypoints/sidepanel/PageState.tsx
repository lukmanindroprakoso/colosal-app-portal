// Shown instead of a feature when the active tab is not the page that feature works on.
export default function PageState({ title, text }: { title: string; text: string }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="muted" style={{ marginBottom: 0 }}>
        {text}
      </p>
    </section>
  )
}
