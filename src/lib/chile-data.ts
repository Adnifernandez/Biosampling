export interface Region {
  id: string;
  number: string;
  name: string;
  communes: string[];
}

export const REGIONS: Region[] = [
  {
    id: "XV",
    number: "XV",
    name: "Arica y Parinacota",
    communes: ["Arica", "Camarones", "Putre", "General Lagos"],
  },
  {
    id: "I",
    number: "I",
    name: "Tarapacá",
    communes: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"],
  },
  {
    id: "II",
    number: "II",
    name: "Antofagasta",
    communes: [
      "Antofagasta", "Mejillones", "Sierra Gorda", "Taltal",
      "Calama", "Ollagüe", "San Pedro de Atacama",
      "Tocopilla", "María Elena",
    ],
  },
  {
    id: "III",
    number: "III",
    name: "Atacama",
    communes: [
      "Copiapó", "Caldera", "Tierra Amarilla",
      "Chañaral", "Diego de Almagro",
      "Vallenar", "Alto del Carmen", "Freirina", "Huasco",
    ],
  },
  {
    id: "IV",
    number: "IV",
    name: "Coquimbo",
    communes: [
      "La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña",
      "Illapel", "Canela", "Los Vilos", "Salamanca",
      "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado",
    ],
  },
  {
    id: "V",
    number: "V",
    name: "Valparaíso",
    communes: [
      "Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar",
      "Isla de Pascua",
      "Los Andes", "Calle Larga", "Rinconada", "San Esteban",
      "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar",
      "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales",
      "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "San Pedro", "Santo Domingo",
      "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María",
      "Quilpué", "Limache", "Olmué", "Villa Alemana",
    ],
  },
  {
    id: "RM",
    number: "RM",
    name: "Región Metropolitana de Santiago",
    communes: [
      "Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central",
      "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana",
      "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú",
      "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura",
      "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Vitacura",
      "Puente Alto", "Pirque", "San José de Maipo",
      "Colina", "Lampa", "Tiltil",
      "San Bernardo", "Buin", "Calera de Tango", "Paine",
      "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro",
      "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor",
    ],
  },
  {
    id: "VI",
    number: "VI",
    name: "O'Higgins",
    communes: [
      "Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras",
      "Machalí", "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco",
      "Rengo", "Requínoa", "San Vicente de Tagua Tagua",
      "Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones",
      "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla",
      "Peralillo", "Placilla", "Pumanque", "Santa Cruz",
    ],
  },
  {
    id: "VII",
    number: "VII",
    name: "Maule",
    communes: [
      "Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue",
      "Río Claro", "San Clemente", "San Rafael",
      "Cauquenes", "Chanco", "Pelluhue",
      "Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén",
      "Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas",
    ],
  },
  {
    id: "XVI",
    number: "XVI",
    name: "Ñuble",
    communes: [
      "Chillán", "Bulnes", "Cobquecura", "Coelemu", "Coihueco", "Chillán Viejo", "El Carmen",
      "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil",
      "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay",
    ],
  },
  {
    id: "VIII",
    number: "VIII",
    name: "Biobío",
    communes: [
      "Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco",
      "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Hualpén",
      "Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa",
      "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete",
      "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío",
    ],
  },
  {
    id: "IX",
    number: "IX",
    name: "La Araucanía",
    communes: [
      "Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro",
      "Loncoche", "Melipeuco", "Nueva Imperial", "Padre las Casas", "Perquenco", "Pitrufquén",
      "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol",
      "Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces",
      "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria",
    ],
  },
  {
    id: "XIV",
    number: "XIV",
    name: "Los Ríos",
    communes: [
      "Valdivia", "Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco",
      "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "Río Bueno",
    ],
  },
  {
    id: "X",
    number: "X",
    name: "Los Lagos",
    communes: [
      "Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos",
      "Llanquihue", "Maullín", "Puerto Varas",
      "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón",
      "Queilén", "Quellón", "Quemchi", "Quinchao",
      "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo",
      "Chaitén", "Futaleufú", "Hualaihué", "Palena",
    ],
  },
  {
    id: "XI",
    number: "XI",
    name: "Aysén del General Carlos Ibáñez del Campo",
    communes: [
      "Coyhaique", "Lago Verde",
      "Aysén", "Cisnes", "Guaitecas",
      "Cochrane", "O'Higgins", "Tortel",
      "Chile Chico", "Río Ibáñez",
    ],
  },
  {
    id: "XII",
    number: "XII",
    name: "Magallanes y de la Antártica Chilena",
    communes: [
      "Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio",
      "Cabo de Hornos", "Antártica",
      "Porvenir", "Primavera", "Timaukel",
      "Natales", "Torres del Paine",
    ],
  },
];

export function getRegionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

export function getCommunesByRegion(regionId: string): string[] {
  return getRegionById(regionId)?.communes ?? [];
}
