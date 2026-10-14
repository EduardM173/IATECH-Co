const input =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500";
export default function InventoryFilters({ fields, criteria, onChange }) {
  function update(index, patch) {
    onChange({
      ...criteria,
      page: 1,
      filters: criteria.filters.map((filter, i) =>
        i === index ? { ...filter, ...patch } : filter,
      ),
    });
  }
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Buscar en el inventario"
          type="search"
          maxLength={200}
          placeholder="Buscar en las columnas de texto"
          value={criteria.q}
          onChange={(e) =>
            onChange({ ...criteria, q: e.target.value, page: 1 })
          }
          className={input + " w-full max-w-sm"}
        />
        <button
          type="button"
          disabled={criteria.filters.length >= 10}
          onClick={() =>
            onChange({
              ...criteria,
              page: 1,
              filters: [
                ...criteria.filters,
                { column: fields[0].name, op: "eq", value: "" },
              ],
            })
          }
          className={input}
        >
          Añadir filtro
        </button>
        {(criteria.q || criteria.filters.length > 0) && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...criteria, q: "", filters: [], page: 1 })
            }
            className="text-sm text-rose-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {criteria.filters.map((filter, index) => {
        const field = fields.find((f) => f.name === filter.column);
        const choices = [
          "eq",
          "ne",
          "isNull",
          "notNull",
          ...(field.type === "varchar"
            ? ["contains"]
            : ["gte", "lte", "between"]),
        ];
        const labels = {
          eq: "Igual a",
          ne: "Diferente de",
          isNull: "Sin dato (NULL)",
          notNull: "Con dato",
          contains: "Contiene",
          gte: "Desde / mínimo",
          lte: "Hasta / máximo",
          between: "Entre",
        };
        const type =
          field.type === "date"
            ? "date"
            : field.type === "timestamp"
              ? "datetime-local"
              : field.type === "int"
                ? "number"
                : "text";
        const nullFilter = ["isNull", "notNull"].includes(filter.op);
        return (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3"
          >
            <select
              aria-label={"Columna del filtro " + (index + 1)}
              value={filter.column}
              onChange={(e) =>
                update(index, {
                  column: e.target.value,
                  op: "eq",
                  value: "",
                  to: "",
                })
              }
              className={input}
            >
              {fields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              aria-label={"Operador del filtro " + (index + 1)}
              value={filter.op}
              onChange={(e) => update(index, { op: e.target.value })}
              className={input}
            >
              {choices.map((op) => (
                <option key={op} value={op}>
                  {labels[op]}
                </option>
              ))}
            </select>
            {!nullFilter &&
              (field.values ? (
                <select
                  aria-label={"Valor del filtro " + (index + 1)}
                  className={input}
                  value={filter.value ?? ""}
                  onChange={(e) => update(index, { value: e.target.value })}
                >
                  <option value="">Seleccionar valor</option>
                  {field.values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={"Valor del filtro " + (index + 1)}
                  type={type}
                  value={filter.value ?? ""}
                  maxLength={field.length ?? 200}
                  onChange={(e) => update(index, { value: e.target.value })}
                  className={input}
                />
              ))}
            {filter.op === "between" && (
              <>
                <span className="text-sm">y</span>
                <input
                  aria-label={"Fin del rango " + (index + 1)}
                  type={type}
                  value={filter.to ?? ""}
                  onChange={(e) => update(index, { to: e.target.value })}
                  className={input}
                />
              </>
            )}
            <button
              type="button"
              aria-label={"Quitar filtro " + (index + 1)}
              onClick={() =>
                onChange({
                  ...criteria,
                  page: 1,
                  filters: criteria.filters.filter((_, i) => i !== index),
                })
              }
              className="ml-auto text-sm text-rose-700"
            >
              Quitar
            </button>
          </div>
        );
      })}
      {criteria.filters.length > 1 && (
        <p className="text-xs text-slate-500">
          Se deben cumplir todos los filtros.
        </p>
      )}
    </div>
  );
}
