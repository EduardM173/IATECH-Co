import { useState } from "react";
import { saveInventory } from "../lib/api";
const input = "inventory-editor-input";

const fieldLabels = {
  nombre: "Nombre",
  nombre_activo: "Nombre del activo",
  nombre_herramienta: "Nombre de la herramienta",
  nombre_dispositivo: "Nombre del dispositivo",
  categoria_recurso: "Categoría del recurso",
  funcion_seguridad: "Función de seguridad",
  responsable_owner: "Responsable / owner",
  criticidad: "Criticidad",
  estado_gestion: "Estado de gestión",
  fecha_ultima_revision: "Fecha de última revisión",
  resultado_revision: "Resultado de revisión",
  tipo_activo: "Tipo de activo",
  fuente_origen: "Fuente de origen",
  clasificacion_sensibilidad: "Clasificación de sensibilidad",
  ubicacion_repositorio: "Ubicación del repositorio",
  direccion_ip: "Dirección IP",
  area_pertenencia: "Área de pertenencia",
  protocolo_enrutamiento: "Protocolo de enrutamiento",
};

function readableField(name) {
  if (fieldLabels[name]) return fieldLabels[name];
  const words = name.replaceAll("_", " ");
  return words.charAt(0).toLocaleUpperCase("es") + words.slice(1);
}

export default function InventoryEditor({
  config,
  area,
  token,
  record,
  onClose,
  onSaved,
}) {
  const editable = config.fields.filter((f) => !f.automatic);
  const securityGroups = [
    {
      title: "Información general",
      names: ["nombre", "categoria_recurso", "funcion_seguridad", "responsable"],
    },
    {
      title: "Gestión del recurso",
      names: ["criticidad", "estado_gestion"],
    },
    {
      title: "Última revisión",
      names: ["fecha_ultima_revision", "resultado_revision"],
    },
  ];
  const usedSecurityFields = new Set(securityGroups.flatMap((group) => group.names));
  const formSections =
    area === "seguridad"
      ? [
          ...securityGroups.map((group) => ({
            title: group.title,
            fields: editable.filter((field) => group.names.includes(field.name)),
          })),
          {
            title: "Otros datos del recurso",
            fields: editable.filter((field) => !usedSecurityFields.has(field.name)),
          },
        ].filter((section) => section.fields.length)
      : [
          {
            title: "Información del recurso",
            fields: editable.filter(
              (field) => !["date", "timestamp", "decimal"].includes(field.type),
            ),
          },
          {
            title: "Fechas y valores",
            fields: editable.filter((field) =>
              ["date", "timestamp", "decimal"].includes(field.type),
            ),
          },
        ].filter((section) => section.fields.length);
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
  const errorField = error
    ? editable.find((field) => {
        const escaped = field.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[^\\w])${escaped}(?:$|[^\\w])`, "i").test(
          error,
        );
      })
    : null;
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
      className="inventory-form-card"
    >
      <form onSubmit={submit}>
        {formSections.map((section) => (
          <fieldset className="inventory-form-section" key={section.title}>
            <legend>{section.title}</legend>
            {section.title === "Información general" && area === "seguridad" && (
              <p className="inventory-form-section-note">
                Identifica el recurso, su función y quién es responsable.
              </p>
            )}
            <div className="inventory-form-grid">
              {section.fields.map((field) => {
                const value = values[field.name],
                  isNull = value === null;
                return (
                  <label key={field.name} className="inventory-form-field">
                    <span className="inventory-form-label">
                      {readableField(field.name)}
                    </span>
                    {!field.nullable && (
                      <span className="inventory-required" aria-hidden="true">
                        *
                      </span>
                    )}
                    {field.values ? (
                      <select
                        disabled={isNull}
                        required={!field.nullable}
                        className={input}
                        id={`${area}-${field.name}`}
                      aria-invalid={errorField?.name === field.name || undefined}
                      aria-describedby={
                        errorField?.name === field.name
                          ? `${area}-${field.name}-error`
                          : undefined
                      }
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
                        inputMode={
                          field.type === "decimal" ? "decimal" : undefined
                        }
                        placeholder={
                          field.type === "decimal" ? "0.00" : undefined
                        }
                        className={input}
                        id={`${area}-${field.name}`}
                        aria-invalid={errorField?.name === field.name || undefined}
                        aria-describedby={
                          errorField?.name === field.name
                            ? `${area}-${field.name}-error`
                            : undefined
                        }
                        value={value ?? ""}
                        onChange={(e) =>
                          setValues({ ...values, [field.name]: e.target.value })
                        }
                      />
                    )}
                    {field.nullable && (
                      <span className="inventory-null-toggle">
                        <input
                          type="checkbox"
                          aria-label={`Dejar ${readableField(field.name).toLocaleLowerCase("es")} sin dato (NULL)`}
                          checked={isNull}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [field.name]: e.target.checked ? null : "",
                            })
                          }
                        />
                        <span>Dejar sin dato</span>
                        <span className="inventory-null-value">NULL</span>
                      </span>
                    )}
                    {errorField?.name === field.name && (
                      <span
                        id={`${area}-${field.name}-error`}
                        className="inventory-form-field-error"
                      >
                        {error}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p className="inventory-form-note">
          El identificador y las fechas automáticas los gestiona la base de
          datos.
        </p>
        {error && !errorField && (
          <p role="alert" className="inventory-message">
            {error}
          </p>
        )}
        <div className="inventory-form-actions">
          <button
            disabled={saving}
            className="inventory-button inventory-button-primary"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onClose} className="inventory-button">
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
