# Generador de Guardias

Aplicación para organizar las guardias de residentes en Urgencias (y, en el
futuro, otros servicios como UCI). Cada residente gestiona sus propias
preferencias y vacaciones desde su cuenta; el administrador genera un
borrador de cuadrante mensual de forma automática y puede ajustarlo a mano
antes de publicarlo.

## Reglas del cuadrante de Urgencias

- 4 puertas: **P1, P2, P3, P4**.
- 2 residentes por puerta, de **lunes a viernes**.
- Cada residente hace como máximo **4 guardias al mes** (configurable por
  residente).
- Se respetan las **vacaciones** (bloquean por completo) y las
  **preferencias** (días de la semana preferidos/a evitar, puerta
  preferida, fechas puntuales a evitar).
- El reparto es equitativo: prioriza a quien menos guardias lleva ese mes
  y, como desempate, a quien menos guardias acumula históricamente en el
  servicio. Pensado para escalar a 60+ residentes.
- Si no hay suficientes residentes disponibles para cubrir todos los
  huecos, el sistema no falla: deja esos huecos marcados para que el
  admin los revise y complete a mano.

## Arquitectura

- **backend/**: Node.js + Express + TypeScript + Prisma (SQLite en
  desarrollo, fácilmente migrable a PostgreSQL). Autenticación JWT con dos
  roles (`ADMIN`, `RESIDENT`).
- **frontend/**: React + TypeScript + Vite + Tailwind CSS.

El modelo de datos separa `Service` (Urgencias, UCI...) de `Post` (las
puertas), así que añadir un nuevo servicio como UCI en el futuro es
cuestión de crear el `Service` y sus puestos correspondientes, reutilizando
todo lo demás (residentes, vacaciones, algoritmo de generación, UI).

## Poner en marcha el proyecto

### Backend

```bash
cd backend
npm install
cp .env.example .env   # revisa JWT_SECRET y DATABASE_URL
npx prisma migrate deploy
npm run seed            # crea el servicio "Urgencias" (P1-P4) y un admin de prueba
npm run dev              # http://localhost:4000
```

El seed crea el usuario administrador `admin@guardias.local` /
`admin1234`. **Cámbialo antes de usarlo en producción.**

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy a la API en :4000)
```

### Tests

```bash
cd backend
npm test                  # tests del algoritmo de generación de cuadrantes
```

## Flujo de uso

1. El primer usuario que se registra se convierte automáticamente en
   `ADMIN` (o usa el admin del seed).
2. Los residentes se registran ellos mismos desde `/register`.
3. Cada residente indica sus preferencias mensuales y vacaciones.
4. El admin, desde "Cuadrante", genera el borrador del mes, revisa los
   huecos sin cubrir (si los hay), ajusta manualmente lo que haga falta y
   publica el cuadrante.
5. Los residentes ven sus guardias publicadas en "Mi cuadrante".

## Próximos pasos sugeridos

- Añadir el servicio de UCI (mismo modelo, nuevo `Service` + `Post`s).
- Exportar el cuadrante a PDF/Excel.
- Notificaciones (email) cuando se publica un cuadrante nuevo.
- Panel de estadísticas de reparto por residente a lo largo del año.
