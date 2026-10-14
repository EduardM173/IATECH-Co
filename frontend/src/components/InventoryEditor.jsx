import { useState } from "react";
import { saveInventory } from "../lib/api";
const input =
  "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 outline-none";
export default function InventoryEditor({
  config,
  area,
  token,
  record,
  onClose,
  onSaved,
}) {
  const editable = config.fields.filter((f) => !f.automatic);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      editable.map((field) => [
        field.name,
        record
          ? record[field.name]
          : (field.defaultValue ?? (field.nullable ? null : "")),
      ]),
    ),
  );
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveInventory(area, token, values, record?.[config.id]);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      aria-label={record ? "Editar registro" : "Nuevo registro"}
      className="mb-6 rounded-xl border border-rose-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex justify-between gap-4">
        <h3 className="font-semibold">
          {record ? "Editar registro " + record[config.id] : "Nuevo registro"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-500"
        >
          Cerrar
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {editable.map((field) => {
            const value = values[field.name],
              isNull = value === null;
            return (
              <label
                key={field.name}
                className="text-sm font-medium text-slate-600"
              >
                {field.name}
                {!field.nullable && <span className="text-rose-600"> *</span>}
                {field.values ? (
                  <select
                    disabled={isNull}
                    required={!field.nullable}
                    className={input}
                    value={value ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.name]: e.target.value })
                    }
                  >
                    <option value="">Seleccionar</option>
                    {field.values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled={isNull}
                    required={!field.nullable}
                    type={field.type === "date" ? "date" : "text"}
                    maxLength={field.length}
                    inputMode={field.type === "decimal" ? "decimal" : undefined}
                    placeholder={field.type === "decimal" ? "0.00" : undefined}
                    className={input}
                    value={value ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.name]: e.target.value })
                    }
                  />
                )}
                {field.nullable && (
                  <span className="mt-2 flex items-center gap-2 text-xs font-normal">
                    <input
                      type="checkbox"
                      checked={isNull}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [field.name]: e.target.checked ? null : "",
                        })
                      }
                    />
                    Sin dato (NULL)
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          El identificador y las fechas automáticas los gestiona la base de
          datos.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            disabled={saving}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
