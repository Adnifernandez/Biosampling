# BioSampling

Aplicación web para registrar muestreos de flora y fauna en terreno.

- Se organiza en **proyectos → campañas → estaciones (parcelas o transectos) → registros**.
- Funciona **sin conexión** en el celular y sincroniza los registros cuando vuelve la señal.
- Genera **reportes Word** y **listados Excel** de especies.
- Tiene usuarios con rol `USER` o `ADMIN`, que se administran desde la misma app (Admin → Usuarios).

**Hoy:** la app está publicada en Vercel y la base de datos está en Supabase.

---

## Tecnología

| Parte | Herramienta |
|---|---|
| App | Next.js 16 + React 19 (requiere **Node.js 20.9 o superior**) |
| Base de datos | PostgreSQL con la extensión `unaccent`, usada a través de Prisma 5 |
| Inicio de sesión | Auth.js v5 (correo y contraseña) |
| Modo sin conexión | Service worker (`public/sw.js`) y almacenamiento local en el navegador |

---

## Requisitos para instalarla en un servidor propio

1. **Node.js 20.9 o superior** (se recomienda una versión LTS).
2. **Dirección con HTTPS**, por ejemplo `https://biosampling.empresa.cl`. Es obligatoria: sin HTTPS, los celulares bloquean el GPS y el modo sin conexión.
3. **Acceso desde internet.** Los usuarios sincronizan desde terreno, fuera de la red de la empresa.
4. **Proxy inverso** (nginx, IIS u otro) delante de la app, que:
   - acepte envíos de **al menos 5 MB**, porque la sincronización incluye fotos (la app admite hasta 4 MB por envío);
   - no acumule las respuestas antes de enviarlas, para que las páginas carguen por partes. En nginx: `proxy_buffering off;`.
5. **PostgreSQL 14 o superior**, solo si la base de datos también se traslada a la empresa (ver más abajo).

---

## Configuración (`.env`)

Se crea a mano en el servidor. **Nunca se sube a GitHub.**

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DIRECT_URL` | Conexión directa a PostgreSQL. En Supabase es distinta de la anterior; con una base propia puede ser la misma. |
| `AUTH_SECRET` | Clave para las sesiones. Generar una nueva con `npx auth secret` o `openssl rand -base64 32`. |
| `AUTH_URL` | Dirección pública de la app, por ejemplo `https://biosampling.empresa.cl` |
| `AUTH_TRUST_HOST` | `true`. Es necesaria fuera de Vercel para que funcione el inicio de sesión. |

---

## Instalación

```bash
git clone https://github.com/Adnifernandez/Biosampling.git
cd Biosampling
# crear el archivo .env (ver arriba)
npm ci
npm run build
npm start                 # puerto 3000 por defecto
# otro puerto:  npm start -- -p 8080
```

Para que la app quede funcionando de forma permanente y se reinicie sola, se puede usar, por ejemplo, **PM2** o un servicio de Windows (NSSM):

```bash
pm2 start npm --name biosampling -- start
pm2 save
```

---

## Base de datos

**Opción A: mantener Supabase.** Solo hay que usar las mismas `DATABASE_URL` y `DIRECT_URL` que hoy.

**Opción B: PostgreSQL propio.**

1. Crear la base y activar la extensión:
   ```sql
   CREATE EXTENSION IF NOT EXISTS unaccent;
   ```
2. Copiar los datos desde Supabase (solo el esquema `public`), usando la conexión de `DIRECT_URL`:
   ```bash
   pg_dump "<DIRECT_URL de Supabase>" --schema=public --no-owner --no-privileges -Fc -f biosampling.dump
   pg_restore -d "<conexión nueva>" --no-owner --no-privileges biosampling.dump
   ```
3. Verificar que la cantidad de usuarios, proyectos, registros y especies coincida con la de Supabase.

> El proyecto no usa migraciones: la estructura de la base está en `prisma/schema.prisma`. Si se cambia la estructura, se aplica con `npx prisma db push`. **Revise siempre lo que va a cambiar antes de aplicarlo.**

---

## Actualizar la app

```bash
git pull
npm ci
npm run build
pm2 restart biosampling    # o reiniciar el servicio que corresponda
```

---

## Antes de cambiar de dirección (importante)

- **Todos los usuarios deben sincronizar sus registros pendientes antes del cambio.** Lo guardado sin conexión queda en el navegador asociado a la dirección antigua y no aparecerá en la nueva.
- Avisar la nueva dirección. En los celulares, volver a agregar la app a la pantalla de inicio.
- Actualizar los manuales que mencionan `biosampling-app.vercel.app`.

---

## Precauciones

- **No ejecutar** `prisma migrate reset` ni `prisma db push --force-reset` contra la base real: **borran todos los datos.**
- Los antiguos comandos de carga inicial ("seed") se quitaron el 20-11-2026 porque borraban registros reales.

---

## Uso local (para probar cambios)

```bash
npm install
npm run dev               # abre http://localhost:3000
```
