# Prompts para Claude Code — Sistema de agenda médica

> Ejecutar en orden estricto. Cada fase es un prompt independiente.  
> Leer `clinica-planificacion.md` antes de empezar.  
> No mezclar fases en un solo prompt.

---

## Fase 1 — Scaffolding del proyecto

```
Crea un proyecto Node.js con Express y TypeScript con esta estructura de carpetas:

src/
  routes/
  controllers/
  services/
  middlewares/
  models/
  jobs/
  utils/

Requisitos:
- ESLint + Prettier configurados
- tsconfig.json con strict: true
- nodemon para desarrollo
- dotenv para variables de entorno
- Archivo .env.example con estas variables vacías:
    DATABASE_URL=
    JWT_SECRET=
    JWT_EXPIRES_IN=
    PORT=
- .env en .gitignore
- Script de inicio: npm run dev (nodemon) y npm run build

No crees ninguna lógica de negocio todavía. Solo el scaffolding.
```

---

## Fase 2 — Modelo de datos con Prisma

```
Instala Prisma y configura PostgreSQL. Crea el schema con estos modelos exactos:

Doctor:
  id            String    @id @default(uuid())
  name          String
  specialty     String
  slotDuration  Int       @default(30)
  avgDuration   Int?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  appointments  Appointment[]
  user          User?

User:
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     (enum: ADMIN, DIRECTOR, DOCTOR)
  doctorId     String?  @unique
  doctor       Doctor?  @relation(fields: [doctorId], references: [id])
  createdAt    DateTime @default(now())
  createdAppointments    Appointment[] @relation("CreatedBy")
  cancelledAppointments  Appointment[] @relation("CancelledBy")
  appointmentEvents      AppointmentEvent[]

Patient:
  id        String   @id @default(uuid())
  name      String
  phone     String
  email     String?
  notes     String?
  createdAt DateTime @default(now())
  appointments Appointment[]

Appointment:
  id             String      @id @default(uuid())
  doctorId       String
  patientId      String
  createdById    String
  cancelledById  String?
  type           AppointmentType   (enum: SCHEDULED, WALKIN)
  status         AppointmentStatus (enum: SCHEDULED, WAITING, ARRIVED, IN_CONSULTATION, ATTENDED, CANCELLED, NO_SHOW)
  scheduledAt    DateTime?
  slotDuration   Int
  checkinAt      DateTime?
  startedAt      DateTime?
  endedAt        DateTime?
  cancelledAt    DateTime?
  cancelReason   String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  doctor         Doctor      @relation(...)
  patient        Patient     @relation(...)
  createdBy      User        @relation("CreatedBy", ...)
  cancelledBy    User?       @relation("CancelledBy", ...)
  events         AppointmentEvent[]

AppointmentEvent:
  id             String      @id @default(uuid())
  appointmentId  String
  changedById    String?     (nullable — null significa sistema automático)
  fromStatus     String
  toStatus       String
  reason         String?
  createdAt      DateTime    @default(now())
  appointment    Appointment @relation(...)
  changedBy      User?       @relation(...)

Genera la migración inicial con: npx prisma migrate dev --name init

Crea un seed en prisma/seed.ts con:
- 1 usuario admin (email: admin@clinica.com, password: admin123)
- 8 médicos con especialidades distintas
- 1 usuario doctor asociado al primer médico
- 3 pacientes de ejemplo
```

---

## Fase 3 — Autenticación JWT

```
Implementa autenticación con JWT en src/routes/auth.ts y src/controllers/auth.controller.ts.

Endpoints:
  POST /api/auth/login
    Body: { email, password }
    Response: { token, user: { id, name, email, role, doctorId } }
    Errores: 401 si credenciales incorrectas

Middlewares en src/middlewares/:
  authenticate.ts
    - Extrae Bearer token del header Authorization
    - Verifica el JWT con JWT_SECRET
    - Adjunta el usuario decodificado a req.user
    - Responde 401 si el token es inválido o falta

  authorize.ts
    - Recibe roles permitidos como parámetro: authorize(['ADMIN', 'DIRECTOR'])
    - Verifica que req.user.role esté en la lista
    - Responde 403 si no tiene permiso
    - Mensaje de error visible: "No tienes permiso para realizar esta acción"

Regla importante: el campo passwordHash nunca debe incluirse en ninguna respuesta de la API.
Usar bcrypt para comparar contraseñas.
```

---

## Fase 4 — CRUD de citas con validación de conflictos

```
Implementa los endpoints de citas en src/routes/appointments.ts.

Endpoints:
  POST /api/appointments
    Roles permitidos: ADMIN
    Body: { doctorId, patientId, scheduledAt }
    Lógica:
      1. Obtener slotDuration del doctor
      2. Verificar que no exista ninguna cita del mismo doctor cuyo rango
         [scheduledAt, scheduledAt + slotDuration minutos] se solape con el nuevo,
         excluyendo status IN ('CANCELLED', 'NO_SHOW')
      3. Si hay conflicto → 409 con mensaje:
         "El Dr. [nombre] ya tiene una cita a las [hora]. Elige otro horario."
      4. Crear la cita con status SCHEDULED
      5. Insertar evento en AppointmentEvent (from: null, to: SCHEDULED)
    Response: la cita creada completa

  GET /api/appointments?doctorId=&date=
    Roles permitidos: ADMIN, DOCTOR (doctor solo puede pedir su propio doctorId)
    Filtra citas por médico y fecha (día completo)
    Incluye: datos del paciente, nombre del médico
    Ordena por scheduledAt ASC, walk-ins al final

  PATCH /api/appointments/:id/status
    Roles permitidos: ADMIN (todas las transiciones), DOCTOR (solo a CANCELLED)
    Body: { status, reason? }
    Lógica:
      1. Obtener la cita actual
      2. Validar que la transición sea permitida según esta tabla:
           SCHEDULED      → ARRIVED, CANCELLED, NO_SHOW
           WAITING        → IN_CONSULTATION, CANCELLED
           ARRIVED        → IN_CONSULTATION, CANCELLED
           IN_CONSULTATION → ATTENDED, CANCELLED
           ATTENDED       → (ninguna)
           CANCELLED      → (ninguna)
           NO_SHOW        → SCHEDULED (solo ADMIN, reversión manual)
      3. Si la transición no es válida → 422 con mensaje descriptivo
      4. Si to_status es CANCELLED y reason está vacío → 400
      5. Actualizar los campos de timestamp correspondientes:
           ARRIVED         → checkinAt = NOW()
           IN_CONSULTATION → startedAt = NOW()
           ATTENDED        → endedAt = NOW()
           CANCELLED       → cancelledAt = NOW(), cancelledById, cancelReason
      6. Insertar evento en AppointmentEvent
      7. Si to_status es ATTENDED, disparar cálculo de promedio del doctor (ver Fase 8)
    Response: la cita actualizada

  DELETE /api/appointments/:id
    No implementar DELETE físico. Las cancelaciones van por PATCH /status.
```

---

## Fase 5 — Walk-ins

```
Agrega soporte para walk-ins.

Endpoint:
  POST /api/appointments/walkin
    Roles permitidos: ADMIN
    Body: { doctorId, patientId }
    Lógica:
      1. Crear cita con type: WALKIN, status: WAITING, scheduledAt: null
      2. slotDuration se copia del doctor igual que una cita normal
      3. Insertar evento en AppointmentEvent (from: null, to: WAITING)
    Response: la cita creada

Modificar GET /api/appointments?doctorId=&date= para incluir walk-ins:
  - Los walk-ins del día aparecen con los de su fecha de creación
  - En la respuesta, incluir un campo separado walkins: [] además de appointments: []
  - O bien un campo type en cada cita para que el frontend los separe

Las transiciones de walk-ins ya están cubiertas por PATCH /status de la Fase 4:
  WAITING → IN_CONSULTATION y WAITING → CANCELLED
```

---

## Fase 6 — Job de no-show automático

```
Crea un job en src/jobs/noshow.job.ts usando node-cron.

Lógica (ejecutar cada minuto):
  1. Buscar todas las citas WHERE:
       status = 'SCHEDULED'
       AND scheduledAt < NOW() - INTERVAL 15 minutos
  2. Para cada cita encontrada:
       a. UPDATE status = 'NO_SHOW'
       b. INSERT en AppointmentEvent:
            fromStatus: 'SCHEDULED'
            toStatus: 'NO_SHOW'
            changedById: null  ← null significa sistema automático
            reason: 'Marcado automáticamente por inasistencia'
  3. Registrar en consola cuántas citas fueron marcadas (para debugging)

Inicializar el job en src/index.ts al arrancar el servidor.
El job NO debe tocar citas con status distinto a SCHEDULED.
```

---

## Fase 7 — Reporte del día

```
Implementa el endpoint de reporte en src/routes/reports.ts.

Endpoint:
  GET /api/reports/daily?date=YYYY-MM-DD&doctorId=
    Roles permitidos: ADMIN, DIRECTOR
    doctorId es opcional — si se omite, devuelve resumen de todos los médicos
    
    Response por médico:
    {
      doctorId: string,
      doctorName: string,
      date: string,
      scheduled: number,     ← citas programadas del día (excluyendo walk-ins)
      attended: number,
      cancelled: number,
      noShow: number,
      walkins: number,       ← walk-ins registrados en esa fecha
      avgRealDuration: number | null   ← promedio real del día en minutos
    }

Fuente de verdad: tabla appointment_events.
Usar los eventos del día para contar — no el status actual de la cita.
Esto permite que una cita cancelada y re-agendada cuente como cancelación en el reporte,
aunque en appointments su status final sea SCHEDULED.

Ejemplo de query base:
  SELECT toStatus, COUNT(*) 
  FROM appointment_events ae
  JOIN appointments a ON ae.appointmentId = a.id
  WHERE a.doctorId = $1
    AND DATE(ae.createdAt) = $2
  GROUP BY toStatus
```

---

## Fase 8 — Cálculo de promedio histórico

```
Crea una función en src/services/doctor.service.ts: recalculateAvgDuration(doctorId).

Lógica:
  1. Query:
       SELECT AVG(
         EXTRACT(EPOCH FROM (endedAt - startedAt)) / 60
       ) as avg_minutes,
       COUNT(*) as total
       FROM appointments
       WHERE doctorId = $1
         AND endedAt IS NOT NULL
         AND startedAt IS NOT NULL
         AND EXTRACT(EPOCH FROM (endedAt - startedAt)) / 60 BETWEEN 5 AND 90

  2. Si total >= 10:
       UPDATE doctors SET avgDuration = ROUND(avg_minutes) WHERE id = $1
  3. Si total < 10:
       No actualizar — avgDuration permanece null

Llamar esta función desde PATCH /appointments/:id/status
cuando la transición es → ATTENDED.

No crear un job separado para esto — el cálculo se dispara por evento,
no en batch nocturno, para que el dato esté actualizado durante el día.
```

---

## Fase 9 — Frontend

```
Crea una SPA con React + Vite + TypeScript.
Instala: react-router-dom, axios, date-fns.

Estructura de rutas:
  /login                    → LoginPage (pública)
  /admin/agenda             → AdminAgendaPage (rol: ADMIN)
  /admin/walkin             → WalkinPage (rol: ADMIN)
  /admin/reportes           → ReportesPage (rol: ADMIN, DIRECTOR)
  /doctor/agenda            → DoctorAgendaPage (rol: DOCTOR)

Comportamiento global:
  - Guardar el JWT en memoria (no localStorage) o en una cookie httpOnly
  - Axios interceptor que adjunta el token a cada request
  - Si la API responde 401 → redirigir a /login
  - Si la API responde 403 → mostrar estado vacío con mensaje:
    "No tienes permiso para ver esta sección"
  - Polling cada 30 segundos en las vistas de agenda para refrescar datos

Vista AdminAgendaPage:
  - Selector de médico (dropdown con los 8 doctores)
  - Selector de fecha (default: hoy)
  - Lista de citas del día con chip de estado coloreado:
      SCHEDULED      → gris
      ARRIVED        → azul
      IN_CONSULTATION → amarillo/ámbar
      ATTENDED       → verde
      CANCELLED      → rojo tachado
      NO_SHOW        → rojo
  - Botones de acción por cita según transiciones válidas del estado actual
  - Cola de walk-ins separada en el mismo panel
  - Formulario de nueva cita: selector de médico, paciente, fecha y hora
    (los slots ya ocupados aparecen deshabilitados en el selector de hora)
  - Si la API responde 409 al guardar: mostrar error inline en el formulario,
    no un alert del navegador

Vista DoctorAgendaPage:
  - Solo muestra la agenda del doctor autenticado
  - Mismos chips de estado
  - Puede cancelar una cita (modal con campo de razón obligatorio)
  - No puede crear ni cambiar otros estados

Vista ReportesPage:
  - Selector de fecha
  - Tabla con resumen por médico: programadas, atendidas, canceladas, no-shows, walk-ins
  - Solo lectura

Heurísticas de Nielsen a respetar:
  - Visibilidad del estado: el chip y el fondo de la fila cambian con el estado
  - Prevención de errores: slots ocupados deshabilitados antes de intentar guardar
  - Correspondencia con el mundo real: mostrar "En consulta", no "IN_CONSULTATION"
  - Control y libertad: confirmación antes de cancelar, con campo de razón
  - Consistencia: mismo sistema de color en todas las vistas
  - Errores visibles: mensajes inline que explican qué pasó y cómo resolverlo
```

---

## Checklist de entrega

Antes de entregar, verificar:

- [ ] `.env` no está en el repositorio
- [ ] `.env.example` tiene todas las variables con valores vacíos
- [ ] `password_hash` nunca aparece en respuestas de la API
- [ ] El job de no-show corre y funciona (probar manualmente)
- [ ] El endpoint 409 retorna mensaje legible (no stack trace)
- [ ] La validación de conflicto de horario funciona con un test manual
- [ ] Un doctor no puede ver la agenda de otro doctor
- [ ] El diagrama Mermaid está en el README y se renderiza en GitHub
- [ ] El README explica las 4 decisiones de negocio (duración, walk-ins, cancelación, no-show)
- [ ] `npm run build` no tiene errores de TypeScript
