# Cómo desplegar la app (link público para usar de verdad)

Vamos a poner el backend (con su base de datos) en **Railway** y el
frontend en **Vercel**. Los dos tienen un plan gratuito suficiente para
empezar. Todo se conecta a tu repositorio de GitHub
(`alvariitoSW/generador-guardias`, rama `claude/resident-oncall-scheduler-sfqthc`),
así que cada vez que se suban cambios nuevos a esa rama, se pueden
redesplegar con un clic.

Tiempo estimado: 15-20 minutos.

## 1. Backend + base de datos en Railway

1. Entra en https://railway.app y crea una cuenta (puedes usar tu cuenta
   de GitHub para entrar directamente).
2. Click en **New Project → Deploy from GitHub repo**. Autoriza a Railway
   a acceder a `alvariitoSW/generador-guardias` y selecciónalo.
3. Railway detectará el repo. Antes de desplegar, entra en la
   configuración del servicio y en **Settings → Root Directory** pon:
   ```
   backend
   ```
4. Todavía en Settings, comprueba que la rama (**Branch**) sea
   `claude/resident-oncall-scheduler-sfqthc`.
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
   migraciones de la base de datos y arrancan el servidor).
8. Cuando termine, en **Settings → Networking** pulsa **Generate Domain**
   para obtener una URL pública, algo como
   `https://generador-guardias-backend.up.railway.app`. Guárdala.
9. Comprueba que funciona abriendo en el navegador:
   `https://TU-URL-DE-RAILWAY/api/health` → debería responder `{"ok":true}`.
10. Crea los datos iniciales (el servicio "Urgencias" con las puertas
    P1-P4 y un usuario administrador). En Railway, abre la pestaña
    **Shell** de tu servicio backend (o la terminal integrada) y ejecuta:
    ```
    npm run seed
    ```
    Esto crea el usuario `admin@guardias.local` con contraseña
    `admin1234`. **Cámbiala en cuanto entres** (de momento no hay pantalla
    para cambiar contraseña, dímelo cuando quieras y la añadimos).

## 2. Frontend en Vercel

1. Entra en https://vercel.com y crea una cuenta con GitHub.
2. Click en **Add New → Project**, elige el repo
   `alvariitoSW/generador-guardias`.
3. En la configuración del proyecto:
   - **Root Directory** → `frontend`
   - **Framework Preset** → Vite (debería detectarlo solo)
   - Rama a desplegar → `claude/resident-oncall-scheduler-sfqthc`
4. En **Environment Variables** añade:
   - `VITE_API_URL` → la URL de Railway del paso anterior + `/api`, por
     ejemplo `https://generador-guardias-backend.up.railway.app/api`
5. Click en **Deploy**. En 1-2 minutos tendrás una URL pública tipo
   `https://generador-guardias.vercel.app` — **ese es el link que puedes
   abrir en Brave (o cualquier navegador) y usar como una app real**.

## 3. Conectar los dos (CORS)

1. Copia la URL final de Vercel (p.ej. `https://generador-guardias.vercel.app`).
2. Vuelve a Railway → tu servicio backend → **Variables** → edita
   `CORS_ORIGIN` y pon esa URL exacta (sin barra al final).
3. Railway reiniciará el backend solo. Espera un minuto y ya está.

## Comprobación final

Abre la URL de Vercel en el móvil o el ordenador:
1. Inicia sesión con `admin@guardias.local` / `admin1234`.
2. Ve a "Cuadrante" y genera el cuadrante de un mes.
3. Abre una ventana en incógnito, entra en `/register` y crea una cuenta
   de residente de prueba para ver cómo lo ve alguien de tu equipo.

Si algo falla (pantalla en blanco, error de login, etc.), dime qué
mensaje ves y lo arreglamos.

## Después del primer despliegue

Cada vez que quieras actualizar la app con cambios nuevos, basta con que
esos cambios se suban (push) a la rama `claude/resident-oncall-scheduler-sfqthc`
en GitHub: tanto Railway como Vercel vuelven a desplegar automáticamente.
