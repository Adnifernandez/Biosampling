# Instructivo de uso — BioSampling

**Versión:** Junio 2026  
**Acceso:** https://biosampling-app.vercel.app

---

## ¿Qué es BioSampling?

BioSampling es una aplicación para registrar muestreos de flora y fauna en terreno. Permite crear proyectos, organizar campañas y réplicas, registrar ocurrencias de especies, y generar reportes.

Funciona **con o sin internet**:
- Con internet (PC o celular): acceso completo a todas las funciones.
- Sin internet (terreno): modo offline para registrar especies, que se sincroniza al volver a conectarse.

---

## Acceso al sistema

**URL:** https://biosampling-app.vercel.app  
**Credenciales:** Tu correo institucional @dss.cl + contraseña asignada.

> Se recomienda usar la aplicación desde **PC o laptop** para crear proyectos, campañas y réplicas antes de salir a terreno. En terreno, usar el celular con el **modo Terreno**.

---

---

# PARTE 1 — USO DESDE PC

> Usar desde PC antes de ir a terreno para preparar toda la estructura de datos.

---

## Paso 1: Crear un Proyecto

Un **Proyecto** agrupa todas las campañas de un mismo trabajo o contrato.

1. En el menú inferior, ir a **Proyectos**.
2. Tocar el botón **"Nuevo proyecto"** (esquina superior derecha).
3. Completar los campos:
   - **Nombre del proyecto** — nombre descriptivo (ej: "Monitoreo Laguna Verde 2026")
   - **Región** — seleccionar del listado (I a XVI)
   - **Comuna** — aparece automáticamente según la región elegida
   - **Descripción** — opcional; notas generales del proyecto
4. Tocar **"Crear proyecto"**.

---

## Paso 2: Crear una Campaña

Una **Campaña** representa una temporada o período de muestreo dentro del proyecto. Puede ser de **Flora** o **Fauna**, con una metodología específica.

1. Dentro del proyecto, tocar **"Nueva campaña"**.
2. Seleccionar el **Tipo de levantamiento**:
   - **Flora** → aparecen metodologías de flora
   - **Fauna** → aparecen metodologías de fauna
3. Seleccionar la **Metodología**:

   | Tipo | Metodologías disponibles |
   |------|--------------------------|
   | Flora | Parcelas BB (Braun-Blanquet) |
   | Flora | Microruteo (Área de influencia) |
   | Flora | Parcelas Forestales (DAT, DAP y Altura) |
   | Flora | Grilla (Delimitación de Humedales) |
   | Fauna | Transecto Lineal Fauna |
   | Fauna | Punto de Conteo |
   | Fauna | Trampa Cámara |
   | Fauna | Red de Niebla |
   | Fauna | VES (Visual Encounter Survey) |

4. Completar los campos:
   - **Fecha de inicio** y **Fecha de término**
   - **Responsable** — seleccionar del listado (opcional)
   - **Notas** — observaciones generales (opcional)
5. Tocar **"Crear campaña"**.

---

## Paso 3: Crear Réplicas (Estaciones)

Las **Réplicas** son las unidades de muestreo dentro de una campaña: parcelas, transectos, puntos, etc.

1. Dentro de la campaña, tocar **"Nueva réplica"**.
2. Indicar la **cantidad** de réplicas a crear (se nombran automáticamente: P1, P2, T1, T2, etc. según metodología).
3. Completar las dimensiones:
   - **Largo y Ancho** (en metros) — el área se calcula automáticamente
   - O ingresar el **Área total** directamente
4. Agregar **Notas** si es necesario (descripción del área, acceso, etc.).
5. Tocar **"Crear réplicas"**.

> Los nombres se generan automáticamente según la metodología:
> - Braun-Blanquet / Microruteo: **P1, P2, P3...**
> - Transectos Fauna: **T1, T2, T3...**
> - Parcelas Forestales: **PF1, PF2, PF3...**
> - Grilla: **T1, T2...** (cada transecto tiene 4 puntos de grilla)

---

## Paso 4: Registrar Ocurrencias (desde PC)

Si se tiene conectividad en terreno o se quiere ingresar datos desde oficina:

1. Ir a la campaña → réplica correspondiente.
2. Tocar **"Nueva ocurrencia"** o **"Registrar especie"**.
3. Buscar la especie por nombre científico, nombre común o familia.
4. Completar los campos según la metodología (cobertura BB, coordenadas UTM, individuos, etc.).
5. Tocar **"Registrar especie"**.

---

## Reportes

Los reportes se generan automáticamente por campaña.

1. Ir al menú **Reportes** (ícono de gráfico).
2. Seleccionar el **Proyecto** y la **Campaña**.
3. Ver los resultados en pantalla: tablas de especies, gráficos de riqueza, abundancia, origen y hábito.
4. Tocar **"Exportar Excel"** para descargar el reporte en formato .xlsx.

> Los reportes incluyen todas las especies registradas, ordenadas alfabéticamente por División → Clase → Familia → Especie.

---

---

# PARTE 2 — MODO TERRENO (OFFLINE)

> Usar desde el **celular** en terreno. Funciona sin internet.

---

## Preparación antes de salir a terreno

**Este paso es fundamental. Hazlo con internet, antes de ir a terreno.**

1. Abrir la app en el celular con internet.
2. Navegar por los proyectos, campañas y réplicas que vas a usar.
3. La app guarda automáticamente estas páginas en caché.
4. Una vez en terreno sin señal, la app seguirá funcionando con los datos guardados.

> Si no navegas primero con internet, la app no tendrá datos disponibles offline.

---

## Instalar la app en el celular (opcional pero recomendado)

Instalar la app como PWA permite abrirla como si fuera una aplicación nativa.

**En Android (Chrome):**
1. Abrir la URL en Chrome.
2. Tocar el menú (⋮) → **"Agregar a pantalla de inicio"**.
3. Confirmar. La app aparecerá en la pantalla de inicio.

**En iPhone (Safari):**
1. Abrir la URL en Safari.
2. Tocar el botón compartir (□↑) → **"Agregar a pantalla de inicio"**.
3. Confirmar.

---

## Usar el Modo Terreno

El **Modo Terreno** es un asistente paso a paso diseñado para trabajar sin internet.

**Cómo acceder:**  
En el menú inferior → **Terreno** (ícono de ubicación/mapa).

Verás un indicador de conexión en la parte superior:
- 🟢 **"Con internet"** — los datos se guardan directamente en el servidor.
- 🟡 **"Sin conexión"** — los datos se guardan localmente y suben al reconectarte.

---

### Paso 1 — Seleccionar Proyecto

- Aparece la lista de proyectos disponibles (guardados en caché).
- Tocar el proyecto en el que vas a trabajar.

---

### Paso 2 — Seleccionar o Crear Campaña

- Aparecen las campañas del proyecto seleccionado.
- Tocar la campaña en la que vas a registrar.

**Si necesitas crear una campaña nueva en terreno:**
1. Tocar **"Nueva campaña"**.
2. Completar:
   - Tipo: **Flora** o **Fauna**
   - Metodología
   - Temporada (Verano / Otoño / Invierno / Primavera)
   - Nombre adicional (opcional, ej: "Norte")
   - Fecha de inicio y término
   - Responsable (opcional)
3. Tocar **"Guardar campaña"** — se guarda localmente con estado **"Pendiente"**.

---

### Paso 3 — Seleccionar o Crear Réplica

- Aparecen las réplicas de la campaña seleccionada.
- Tocar la réplica en la que vas a trabajar.

**Si necesitas crear una réplica nueva en terreno:**
1. Tocar **"Nueva réplica"**.
2. Indicar el **nombre** (se sugiere automáticamente: P1, T1, etc.).
3. Indicar la **cantidad** si vas a crear varias a la vez.
4. Tocar **"Guardar réplica(s)"** — se guarda localmente con estado **"Pendiente"**.

---

### Paso 4 — Registrar Ocurrencias

Aquí registras cada especie observada. El formulario cambia según la metodología de la campaña.

**Buscar una especie:**
- Escribir el nombre científico, nombre común o familia en el campo de búsqueda.
- La búsqueda funciona offline usando la base de datos local.
- Seleccionar la especie de la lista de resultados.

**Campos según metodología:**

| Metodología | Campos principales |
|-------------|-------------------|
| Braun-Blanquet | Especie + Código de cobertura (p, r, +, 1, 2m, 2a, 2b, 3, 4, 5) |
| Microruteo | Especie + Coordenadas UTM (botón GPS) |
| Parcelas Forestales | Especie + individuos con DAT, DAP y Altura |
| Grilla | Grilla de 16 puntos + especie o "Sin Vegetación" por punto |
| Transecto Fauna | Especie + N° individuos + Método de detección + GPS opcional |
| Punto de Conteo | Especie + N° individuos + Método + Distancia |
| Trampa Cámara | Especie + N° individuos en foto + Comportamiento |
| Red de Niebla | Especie + N° individuos + Sexo |
| VES | Especie + N° individuos + Microhábitat |

**Capturar GPS:**
- Tocar el botón **"Capturar GPS"** para registrar las coordenadas del punto.
- El GPS tarda unos segundos en obtener la señal.
- Las coordenadas se guardan automáticamente con el registro.

**Al terminar la réplica:**
- Tocar **"Finalizar estación"** para cerrar la réplica y volver al paso 3.

---

## Sincronización automática

Cuando el celular recupera internet:

1. La app detecta la conexión automáticamente.
2. Los datos pendientes se suben al servidor en orden:
   - Primero: campañas nuevas
   - Luego: réplicas nuevas
   - Finalmente: ocurrencias
3. El estado de cada registro cambia de **"Pendiente"** a **"Subido"**.

> No es necesario hacer nada manual. La sincronización ocurre sola al conectarse.

---

## Resumen: ¿qué hacer antes, durante y después del terreno?

| Momento | Qué hacer |
|---------|-----------|
| **Antes (con internet)** | Crear proyecto, campañas y réplicas desde PC. Navegar la app en el celular para guardar caché. |
| **En terreno (sin internet)** | Usar Modo Terreno para registrar ocurrencias. La app funciona sin señal. |
| **Al volver (con internet)** | Abrir la app. Los datos se sincronizan automáticamente. |
| **En oficina** | Revisar reportes, exportar Excel. |

---

## Contacto y soporte

Para problemas de acceso o dudas técnicas, contactar al administrador del sistema.

---

*BioSampling — DSS © 2026*
