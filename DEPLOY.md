# Cómo desplegar la app (link público para usar de verdad)

## Opción rápida: un clic con Render

El repo incluye un `render.yaml` que describe toda la app (backend +
base de datos + frontend), así que Render puede montarlo todo de golpe:

**[👉 Desplegar en Render](https://render.com/deploy?repo=https://github.com/alvariitoSW/generador-guardias)**

1. Al abrir el link, te pedirá iniciar sesión (puedes hacerlo con tu
   cuenta de GitHub).
2. Render lee `render.yaml` y te muestra un plan con 3 piezas: la base de
   datos, el backend y el frontend. Dale a **Apply** / **Deploy Blueprint**.
3. Espera unos minutos mientras Render instala, compila y arranca todo
   (el backend aplica las migraciones y crea automáticamente el servicio
   "Urgencias" con las puertas P1-P4 y un usuario administrador la
   primera vez que arranca — no hay que ejecutar nada a mano).
4. Cuando termine, entra en el servicio `generador-guardias-frontend` →
   verás su URL pública (algo como
   `https://generador-guardias-frontend.onrender.com`). **Ese es el link
   que abres en Brave y usas como una app real.**

Inicia sesión con `admin@guardias.local` / `admin1234` y cámbiala en
cuanto entres (dime cuando quieras y añadimos una pantalla para
cambiarla).

**Dos cosas a saber del plan gratuito de Render** (no impiden usarlo,
solo para que no te sorprenda):
- Si nadie usa la app durante 15 minutos, el backend "se duerme" y la
  primera visita siguiente tarda ~30-50 segundos en responder mientras
  se despierta. Las siguientes van normales.
- La base de datos gratuita de Render caduca a los 30 días. Si os gusta
  la app, para uso real conviene pasar a un plan de pago (unos
  7 $/mes) o mover la base de datos a otro proveedor.

Si el botón falla o algo no encaja (nombre de servicio ya en uso,
etc.), dime exactamente qué mensaje ves y lo resolvemos.

## Cómo se registran los residentes

Los residentes ya no escriben su nombre libremente: en `/register`
eligen su nombre de una lista cerrada (la que me diste), ponen su email
y su propia contraseña. La cuenta queda **pendiente** hasta que tú la
actives desde "Residentes" en el panel de admin — ahí verás arriba un
aviso con cada registro pendiente (nombre + email) para comprobar que
es quien dice ser antes de activarla. No hace falta configurar nada
para que esto funcione.

Si además quieres que te llegue un email cada vez que alguien se
registra (en vez de solo mirarlo en el panel), añade estas variables de
entorno al servicio backend (en Render: pestaña **Environment** del
servicio `generador-guardias-backend`):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — datos
  de un proveedor de email (por ejemplo Gmail con una "contraseña de
  aplicación", o un servicio como Resend/Postmark).
- `ADMIN_NOTIFY_EMAIL` — a qué dirección quieres que llegue el aviso.

Es opcional; sin ello la app funciona igual, solo que el aviso se ve
únicamente en el panel de admin.

## Opción manual: Railway + Vercel

Si prefieres no depender de un único proveedor, o el plan gratuito de
Render se te queda corto, esta es la alternativa manteniendo el backend
y el frontend en sitios distintos. Es más flexible pero tiene más pasos.

Tiempo estimado: 15-20 minutos.

### 1. Backend + base de datos en Railway

1. Entra en https://railway.app y crea una cuenta (puedes usar tu cuenta
   de GitHub para entrar directamente).
2. Click en **New Project → Deploy from GitHub repo**. Autoriza a Railway
   a acceder a `alvariitoSW/generador-guardias` y selecciónalo.
3. Railway detectará el repo. Antes de desplegar, entra en la
   configuración del servicio y en **Settings → Root Directory** pon:
   ```
   backend
   ```
4. Todavía en Settings, comprueba que la rama (**Branch**) sea `main`.
5. Añade la base de datos: en el proyecto, click en **New → Database →
   Add PostgreSQL**. Railway crea la base de datos y automáticamente
   define la variable `DATABASE_URL` en tu servicio backend (si no lo
   hace solo, ve a la pestaña **Variables** del servicio backend y añade
   una referencia a `DATABASE_URL` de la base de datos Postgres, Railway
   te lo sugiere automáticamente con el botón "Add Reference").
6. En la pestaña **Variables** del servicio backend añade además:
   - `JWT_SECRET` → cualquier texto largo y aleatorio (por ejemplo, genera
     uno en https://www.uuidgenerator.net/ y pégalo).
   - `CORS_ORIGIN` → de momento déjalo vacío, lo rellenamos en el paso 3
     una vez tengamos la URL del frontend.
7. Railway construirá y arrancará el backend solo (usa los scripts
   `npm install`, y luego `npm run build` seguido de `npm start`, que ya
   están preparados: generan el cliente de Prisma, aplican las
   migraciones de la base de datos, crean los datos iniciales y arrancan
   el servidor — no hace falta ejecutar nada a mano).
8. Cuando termine, en **Settings → Networking** pulsa **Generate Domain**
   para obtener una URL pública, algo como
   `https://generador-guardias-backend.up.railway.app`. Guárdala.
9. Comprueba que funciona abriendo en el navegador:
   `https://TU-URL-DE-RAILWAY/api/health` → debería responder `{"ok":true}`.

### 2. Frontend en Vercel

1. Entra en https://vercel.com y crea una cuenta con GitHub.
2. Click en **Add New → Project**, elige el repo
   `alvariitoSW/generador-guardias`.
3. En la configuración del proyecto:
   - **Root Directory** → `frontend`
   - **Framework Preset** → Vite (debería detectarlo solo)
   - Rama a desplegar → `main`
4. En **Environment Variables** añade:
   - `VITE_API_URL` → la URL de Railway del paso anterior + `/api`, por
     ejemplo `https://generador-guardias-backend.up.railway.app/api`
5. Click en **Deploy**. En 1-2 minutos tendrás una URL pública tipo
   `https://generador-guardias.vercel.app` — **ese es el link que puedes
   abrir en Brave (o cualquier navegador) y usar como una app real**.

### 3. Conectar los dos (CORS)

1. Copia la URL final de Vercel (p.ej. `https://generador-guardias.vercel.app`).
2. Vuelve a Railway → tu servicio backend → **Variables** → edita
   `CORS_ORIGIN` y pon esa URL exacta (sin barra al final).
3. Railway reiniciará el backend solo. Espera un minuto y ya está.

## Comprobación final

Abre la URL pública (Render o Vercel, según la opción elegida) en el
móvil o el ordenador:
1. Inicia sesión con `admin@guardias.local` / `admin1234`.
2. Ve a "Cuadrante" y genera el cuadrante de un mes.
3. Abre una ventana en incógnito, entra en `/register`, elige un nombre
   de la lista y crea una cuenta de prueba. Vuelve como admin a
   "Residentes" y actívala para ver el flujo completo.

Si algo falla (pantalla en blanco, error de login, etc.), dime qué
mensaje ves y lo arreglamos.

## Después del primer despliegue

Cada vez que quieras actualizar la app con cambios nuevos, basta con que
esos cambios se suban (push) a la rama `main` en GitHub: Render (o
Railway/Vercel) vuelven a desplegar automáticamente.
