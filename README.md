# Generador de Guardias

Aplicación para organizar las guardias de residentes en Urgencias (y, en el
futuro, otros servicios como UCI). Cada residente gestiona sus propias
preferencias y vacaciones desde su cuenta; el administrador genera un
borrador de cuadrante mensual de forma automática y puede ajustarlo a mano
antes de publicarlo.

## Reglas del cuadrante de Urgencias

- 4 puertas: **P1, P2, P3, P4**.
- 2 residentes por puerta, de **lunes a viernes**.
- Todos hacen **4 guardias al mes por defecto**. Si un residente va a
  hacer menos ese mes, tiene que declararlo él mismo en Preferencias
  (cuántas y, opcionalmente, el motivo); si no dice nada, el objetivo
  sigue siendo 4.
- Se respetan las **vacaciones** (bloquean por completo) y las
  **preferencias** (días del mes preferidos —máx. 3—, días de la semana a
  evitar, puerta preferida).
- **Descanso post-guardia (24h)**: nadie puede tener guardia el día
  siguiente a otra guardia de Urgencias. El día 1 de mes se marca aparte
  con "salgo de guardia el día 1", ya que el generador no ve el mes
  anterior.
- **Guardias del servicio de origen**: los residentes pueden marcar si
  tienen guardias de su propia especialidad ese mes y qué días. Se exige
  un margen mínimo de 4 días (en cualquier dirección) entre una de esas
  guardias y una de Urgencias.
- El reparto es equitativo: prioriza a quien menos guardias lleva ese mes
  y, como desempate, a quien menos guardias acumula históricamente en el
  servicio. Pensado para escalar a 60+ residentes.
- Si no hay suficientes residentes disponibles para cubrir todos los
  huecos, el sistema no falla: deja esos huecos marcados para que el
  admin los revise y complete a mano.

## Arquitectura

- **backend/**: Node.js + Express + TypeScript + Prisma + PostgreSQL.
  Autenticación JWT con dos roles (`ADMIN`, `RESIDENT`).
- **frontend/**: React + TypeScript + Vite + Tailwind CSS.

¿Quieres un link público para usar la app de verdad (no solo el código)?
**[Despliega con un clic en Render](https://render.com/deploy?repo=https://github.com/alvariitoSW/generador-guardias)**
o mira las alternativas en [`DEPLOY.md`](./DEPLOY.md).

El modelo de datos separa `Service` (Urgencias, UCI...) de `Post` (las
puertas), así que añadir un nuevo servicio como UCI en el futuro es
cuestión de crear el `Service` y sus puestos correspondientes, reutilizando
todo lo demás (residentes, vacaciones, algoritmo de generación, UI).

## Poner en marcha el proyecto

### Backend

Necesitas una base de datos PostgreSQL accesible (local, Docker, o una
gratuita en la nube tipo Railway/Neon/Supabase).

```bash
cd backend
npm install
cp .env.example .env   # ajusta DATABASE_URL, JWT_SECRET
npx prisma migrate deploy
npm run seed            # crea "Urgencias" (P1-P4), un admin de prueba y la lista de residentes reclamable
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

Para desplegar en producción, define `VITE_API_URL` con la URL pública del
backend (p.ej. `https://tu-backend.up.railway.app/api`); en desarrollo no
hace falta, se usa el proxy de Vite.

### Tests

```bash
cd backend
npm test                  # tests del algoritmo de generación de cuadrantes
```

## Flujo de uso

1. El admin entra con la cuenta del seed (`admin@guardias.local`).
2. Cada residente se registra en `/register` eligiendo su nombre de la
   lista (no lo escribe libremente) y su propia contraseña. La cuenta
   queda pendiente de activación.
3. El admin activa las cuentas desde "Residentes" (ahí se ve un aviso con
   nombre + email de cada registro pendiente) — opcionalmente también le
   puede llegar un email si se configura SMTP (ver `DEPLOY.md`).
4. Cada residente indica sus preferencias mensuales y vacaciones.
5. El admin, desde "Cuadrante", genera el borrador del mes, revisa los
   huecos sin cubrir (si los hay), ajusta manualmente lo que haga falta y
   publica el cuadrante.
6. Los residentes ven sus guardias publicadas en "Mi cuadrante".
7. Si alguien quiere cambiar una guardia ya publicada, la pide desde
   "Cambios": queda visible para todos por si otro residente quiere
   cambiarla con él (con o sin ofrecer una guardia suya a cambio). El
   cambio solo se aplica si sigue cumpliendo las reglas (descanso de 24h,
   vacaciones, margen con guardias de otro servicio, cuota mensual);
   si no, se rechaza con el motivo.

## Próximos pasos sugeridos

- Añadir el servicio de UCI (mismo modelo, nuevo `Service` + `Post`s).
- Exportar el cuadrante a PDF/Excel.
- Notificaciones (email) cuando se publica un cuadrante nuevo.
- Panel de estadísticas de reparto por residente a lo largo del año.
