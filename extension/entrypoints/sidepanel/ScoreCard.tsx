import type { ProfileScore, ScoreItem } from "../../lib/types"

const badgeClass = (label: ProfileScore["label"]) => (label === "Strong" ? "good" : label === "Needs work" ? "poor" : "")

function Items({ items }: { items: ScoreItem[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.key}>
          <div className="row">
            <strong>{i.label}</strong>
            <span>
              {i.points}/{i.max}
            </span>
          </div>
          {i.note && <div className="muted">{i.note}</div>}
          {i.evidence && <div className="muted quote">&ldquo;{i.evidence}&rdquo;</div>}
        </li>
      ))}
    </ul>
  )
}

export default function ScoreCard({ score }: { score: ProfileScore }) {
  return (
    <section className="card">
      <h3>Profile Score</h3>
      <div className="row" style={{ justifyContent: "flex-start", alignItems: "baseline" }}>
        <span className="score">{score.total}/100</span>
        <span className={`badge ${badgeClass(score.label)}`}>{score.label}</span>
      </div>

      <h3>
        Completeness {score.completeness.points}/{score.completeness.max}
      </h3>
      <Items items={score.completeness.items} />

      <h3>
        Quality {score.quality.points}/{score.quality.max}
      </h3>
      <Items items={score.quality.items} />
    </section>
  )
}
