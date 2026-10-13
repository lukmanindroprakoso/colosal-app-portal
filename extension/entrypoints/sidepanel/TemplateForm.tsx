import { useState } from "react"
import { api } from "../../lib/api"
import type { Template, TemplateInput } from "../../lib/types"

// Create or edit one template (same three fields as the web app's template form).
export default function TemplateForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: TemplateInput
  onSaved: (t: Template) => void | Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.name.trim() || !form.template.trim()) {
      setError("Name and template are required.")
      return
    }
    setSaving(true)
    setError(null)
    const r = await api.saveTemplate(form)
    if (!r.ok) {
      setError(r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message)
      setSaving(false)
      return
    }
    await onSaved(r.data.template)
  }

  return (
    <section className="card">
      <h2>{form.id ? "Edit Template" : "New Template"}</h2>

      <label className="field">
        Name
        <input
          value={form.name}
          maxLength={200}
          placeholder="e.g. General Web Dev"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={saving}
        />
      </label>

      <label className="field">
        Cover Letter Template
        <textarea
          rows={10}
          value={form.template}
          placeholder="Wrap AI-filled sections in [prompt]...[/prompt]"
          onChange={(e) => setForm({ ...form, template: e.target.value })}
          disabled={saving}
        />
        <span className="hint">
          Use <code>[prompt]…[/prompt]</code> to mark sections the AI should fill in per job.
        </span>
      </label>

      <label className="field">
        AI Instruction
        <textarea
          rows={4}
          value={form.ai_instruction}
          placeholder="Guidance for how the AI should fill the [prompt] sections"
          onChange={(e) => setForm({ ...form, ai_instruction: e.target.value })}
          disabled={saving}
        />
      </label>

      {error && <p className="err">{error}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Template"}
        </button>
        <button className="link" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </section>
  )
}
