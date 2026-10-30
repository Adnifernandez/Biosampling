// Equipo de Medio Biótico de DSS: única lista para elegir responsables de campaña y el equipo del reporte Word.
// "corto" es como se guarda en las campañas; "nombre" y "profesion" van en la tabla del reporte.

export const PROFESIONALES_DSS = [
  { corto: "Álvaro Esparza", nombre: "Álvaro Esparza Moreno", profesion: "Ingeniero en Recursos Naturales" },
  { corto: "Ángela Schafer", nombre: "Ángela Schafer Navarro", profesion: "Bióloga Marina" },
  { corto: "Catalina Lastra", nombre: "Catalina Lastra Avendaño", profesion: "Ingeniera en Biotecnología Vegetal" },
  { corto: "Claudia Cortés", nombre: "Claudia Cortés Flores", profesion: "Geógrafa" },
  { corto: "Diego Verdugo", nombre: "Diego Verdugo Parra", profesion: "Biólogo Marino" },
  { corto: "Gabriel Cruz", nombre: "Gabriel Cruz González", profesion: "Biólogo" },
  { corto: "Gabriel Meriot", nombre: "Gabriel Meriot Troncoso", profesion: "Médico Veterinario" },
  { corto: "Karla García", nombre: "Karla García Bustos", profesion: "Bióloga" },
  { corto: "Katterin Gutiérrez", nombre: "Katterin Gutiérrez Inostroza", profesion: "Ingeniera en Recursos Naturales" },
  { corto: "Macarena Toledo", nombre: "Macarena Toledo Muñoz", profesion: "Bióloga" },
  { corto: "Nicolás Cortés", nombre: "Nicolás Cortés Soto", profesion: "Ingeniero en Recursos Naturales" },
  { corto: "Rodrigo Martínez", nombre: "Rodrigo Nicolás Martínez Maldonado", profesion: "Ingeniero en Recursos Naturales" },
  { corto: "Vicente Santibáñez", nombre: "Vicente Santibáñez Bermeo", profesion: "Ingeniero en Conservación de Recursos Naturales" },
];

// Para elegir "Personas responsables" al crear o editar una campaña
export const RESPONSABLES_CAMPANA = PROFESIONALES_DSS.map((p) => p.corto);

const palabras = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).filter(Boolean);

// Campañas antiguas pueden traer otra forma del nombre: se busca quien tenga todas esas palabras
export function buscarProfesional(nombre: string) {
  const buscadas = palabras(nombre);
  if (buscadas.length === 0) return undefined;
  return PROFESIONALES_DSS.find((p) => {
    const completas = palabras(p.nombre);
    return buscadas.every((b) => completas.includes(b));
  });
}
