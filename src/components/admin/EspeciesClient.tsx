"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search, X, FlaskConical } from "lucide-react";
import {
  createSpecies,
  updateSpecies,
  deleteSpecies,
  searchSpecies,
} from "@/app/(app)/admin/especies/actions";

type Species = {
  id: string;
  type: string;
  genus: string;
  species: string;
  family: string;
  commonName: string | null;
  clase: string | null;
  orden: string | null;
  origen: string | null;
  conservationStatus: string | null;
  habito: string | null;
  macrofitasHabito: string | null;
  division: string | null;
  category: string | null;
  endemic: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
  _count: { occurrences: number };
};

const EMPTY_FORM = {
  type: "FAUNA",
  genus: "",
  species: "",
  family: "",
  commonName: "",
  clase: "",
  orden: "",
  origen: "",
  conservationStatus: "",
  habito: "",
  macrofitasHabito: "",
  division: "",
  category: "",
  endemic: false,
};

const CONSERVATION_STATUS = ["LC", "NT", "VU", "EN", "CR", "EW", "EX", "DD"];
const CONSERVATION_COLORS: Record<string, string> = {
  LC: "bg-green-100 text-green-700",
  NT: "bg-blue-100 text-blue-700",
  VU: "bg-yellow-100 text-yellow-700",
  EN: "bg-orange-100 text-orange-700",
  CR: "bg-red-100 text-red-700",
  EW: "bg-purple-100 text-purple-700",
  EX: "bg-gray-200 text-gray-700",
  DD: "bg-gray-100 text-gray-500",
};

export function EspeciesClient() {
  const [results, setResults] = useState<Species[]>([]);
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "FAUNA" | "FLORA">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(q: string, type: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSearchTransition(async () => {
        const res = await searchSpecies(q, type);
        setResults(res as Species[]);
        setSearched(true);
      });
    }, 350);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearch(q);
    runSearch(q, typeFilter);
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const type = e.target.value as "ALL" | "FAUNA" | "FLORA";
    setTypeFilter(type);
    runSearch(search, type);
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(sp: Species) {
    setEditingId(sp.id);
    setForm({
      type: sp.type,
      genus: sp.genus,
      species: sp.species,
      family: sp.family,
      commonName: sp.commonName ?? "",
      clase: sp.clase ?? "",
      orden: sp.orden ?? "",
      origen: sp.origen ?? "",
      conservationStatus: sp.conservationStatus ?? "",
      habito: sp.habito ?? "",
      macrofitasHabito: sp.macrofitasHabito ?? "",
      division: sp.division ?? "",
      category: sp.category ?? "",
      endemic: sp.endemic,
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const data = {
      ...form,
      commonName: form.commonName || undefined,
      clase: form.clase || undefined,
      orden: form.orden || undefined,
      origen: form.origen || undefined,
      conservationStatus: form.conservationStatus || undefined,
      habito: form.habito || undefined,
      macrofitasHabito: form.macrofitasHabito || undefined,
      division: form.division || undefined,
      category: form.category || undefined,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateSpecies(editingId, data)
        : await createSpecies(data);
      if (res.error) { setError(res.error); return; }
      if (res.species) {
        if (editingId) {
          setResults((prev) => prev.map((s) => s.id === editingId ? res.species! as Species : s));
        } else {
          setResults((prev) =>
            [...prev, res.species! as Species].sort((a, b) =>
              a.type.localeCompare(b.type) || a.genus.localeCompare(b.genus) || a.species.localeCompare(b.species)
            )
          );
        }
      }
      closeForm();
    });
  }

  function handleDelete(sp: Species) {
    if (deletingId === sp.id) {
      startTransition(async () => {
        const res = await deleteSpecies(sp.id);
        if (res.error) {
          setDeleteError((prev) => ({ ...prev, [sp.id]: res.error! }));
          setDeletingId(null);
        } else {
          setResults((prev) => prev.filter((s) => s.id !== sp.id));
          setDeletingId(null);
        }
      });
    } else {
      setDeletingId(sp.id);
      setDeleteError((prev) => { const n = { ...prev }; delete n[sp.id]; return n; });
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por género, especie, familia, clase..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={handleTypeChange}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">Flora + Fauna</option>
          <option value="FAUNA">Solo Fauna</option>
          <option value="FLORA">Solo Flora</option>
        </select>
        <Button onClick={openNew} className="bg-teal-700 hover:bg-teal-800 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Nueva especie
        </Button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <Card className="border-2 border-teal-200">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {editingId ? "Editar especie" : "Nueva especie"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <select value={form.type} onChange={f("type")}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="FAUNA">Fauna</option>
                    <option value="FLORA">Flora</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Familia *</Label>
                  <Input value={form.family} onChange={f("family")} placeholder="Ej: Abrocomidae" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Género *</Label>
                  <Input value={form.genus} onChange={f("genus")} placeholder="Ej: Abrocoma" required />
                </div>
                <div className="space-y-1">
                  <Label>Especie *</Label>
                  <Input value={form.species} onChange={f("species")} placeholder="Ej: bennetti" required />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Nombre común *</Label>
                <Input value={form.commonName} onChange={f("commonName")} placeholder="Ej: Ratón chinchilla común" required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Clase *</Label>
                  <Input value={form.clase} onChange={f("clase")} placeholder="Ej: Mammalia" required />
                </div>
                <div className="space-y-1">
                  <Label>Orden *</Label>
                  <Input value={form.orden} onChange={f("orden")} placeholder="Ej: Rodentia" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Origen *</Label>
                  <Input value={form.origen} onChange={f("origen")} placeholder="Ej: Endémico" required />
                </div>
                <div className="space-y-1">
                  <Label>Estado de conservación *</Label>
                  <Input
                    value={form.conservationStatus}
                    onChange={f("conservationStatus")}
                    placeholder="Ej: EN, VU"
                    required
                  />
                  <p className="text-xs text-gray-400">Separa múltiples estados con coma (LC, NT, VU, EN, CR, EW, EX, DD)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hábito</Label>
                  <Input value={form.habito} onChange={f("habito")} placeholder="Ej: Arbusto" />
                </div>
                <div className="space-y-1">
                  <Label>Hábito macrófitas</Label>
                  <Input value={form.macrofitasHabito} onChange={f("macrofitasHabito")} placeholder="Ej: Emergente" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>División *</Label>
                  <Input value={form.division} onChange={f("division")} placeholder="Ej: Magnoliophyta" required />
                </div>
                <div className="space-y-1">
                  <Label>Categoría *</Label>
                  <Input value={form.category} onChange={f("category")} placeholder="Ej: Nativa" required />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.endemic}
                  onChange={(e) => setForm((prev) => ({ ...prev, endemic: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600"
                />
                <span className="text-sm text-gray-700">Especie endémica</span>
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                <Button type="submit" disabled={isPending} className="bg-teal-700 hover:bg-teal-800 text-white">
                  {isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear especie"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Results ── */}
      {!searched && !isSearching ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-sm">Busca una especie por nombre, familia o clase</p>
            <p className="text-gray-400 text-xs mt-1">También puedes filtrar por Flora o Fauna</p>
          </CardContent>
        </Card>
      ) : isSearching ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 text-sm">Buscando...</p>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-sm">No se encontraron especies</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-gray-400">{results.length} resultado{results.length !== 1 ? "s" : ""}{results.length === 80 ? " (mostrando los primeros 80)" : ""}</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Clase / Orden</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Familia</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap italic">Especie</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre Común</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">E.C.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Ocurrencias</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Registro</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((sp) => (
                  <tr key={sp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        sp.type === "FAUNA" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"
                      }`}>
                        {sp.type === "FAUNA" ? "Fauna" : "Flora"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      <div>{sp.clase ?? "—"}</div>
                      <div className="text-gray-400">{sp.orden ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5">{sp.family}</td>
                    <td className="px-4 py-2.5 italic font-medium whitespace-nowrap">{sp.genus} {sp.species}</td>
                    <td className="px-4 py-2.5 text-gray-500">{sp.commonName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      {sp.conservationStatus ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${CONSERVATION_COLORS[sp.conservationStatus] ?? "bg-gray-100 text-gray-600"}`}>
                          {sp.conservationStatus}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{sp._count.occurrences}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {sp.createdBy && <div>Creado por <span className="text-gray-600">{sp.createdBy.name}</span></div>}
                      {sp.updatedBy && sp.updatedBy.name !== sp.createdBy?.name && (
                        <div>Editado por <span className="text-gray-600">{sp.updatedBy.name}</span></div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(sp)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sp)}
                          disabled={isPending}
                          className={`p-1.5 rounded text-sm transition-colors ${
                            deletingId === sp.id
                              ? "bg-red-600 text-white hover:bg-red-700 px-2 rounded-md text-xs font-medium"
                              : "hover:bg-gray-100 text-gray-400 hover:text-red-600"
                          }`}
                          title={deletingId === sp.id ? "Click para confirmar" : "Eliminar"}
                        >
                          {deletingId === sp.id ? "¿Confirmar?" : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                        {deletingId === sp.id && (
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 text-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {deleteError[sp.id] && (
                        <p className="text-xs text-red-500 mt-1 text-right">{deleteError[sp.id]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
