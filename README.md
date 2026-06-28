# Turnia

Sistema de agenda médica en tiempo real para una clínica privada: agenda por médico, control de estados de cada cita, walk-ins, no-show automático y reporte diario.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js · Express · TypeScript (`strict`) |
| ORM / BD | Prisma · PostgreSQL |
| Auth | JWT (access token, expiración 8h) |
| Jobs | node-cron |
| Frontend | React · Vite · TypeScript |
| Tiempo real | Polling cada 30s |

El backend vive en `src/`, el esquema y el seed en `prisma/`, y la SPA en `frontend/`.

## Correr el proyecto localmente

Requisitos: Node 18+, PostgreSQL corriendo y accesible.

### Backend

```bash
# desde la raíz del repo
npm install
cp .env.example .env          # completar las variables (ver abajo)
npx prisma migrate dev        # aplica la migración inicial y genera el cliente
npx prisma db seed            # carga admin, 8 médicos, 1 doctor y 3 pacientes
npm run dev                   # nodemon en http://localhost:3000
```

`.env` requiere:

```
DATABASE_URL=postgresql://usuario:password@localhost:5432/clinica_db
JWT_SECRET=una-clave-larga-y-secreta
JWT_EXPIRES_IN=8h
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000/api (opcional, hay fallback)
npm run dev                   # Vite en http://localhost:5173
```

El frontend toma `VITE_API_URL` y, si no está definida, cae a `http://localhost:3000/api`. El backend solo acepta CORS desde `CORS_ORIGIN`.

## Credenciales de prueba

Las crea el seed (`prisma/seed.ts`):

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@clinica.com` | `admin123` |
| Doctor | `dr.mendez@clinica.com` | `doctor123` |

El usuario doctor está vinculado al primer médico del seed (Dr. Carlos Méndez) y solo ve su propia agenda.

## Decisiones de diseño

### Duración de cita

El MVP usa un slot fijo de 30 minutos por médico, editable por el admin. En paralelo el sistema calcula un promedio histórico real a partir de los timestamps `started_at → ended_at`, pero ese promedio solo se usa como referencia cuando el médico acumula al menos 10 consultas con ambos timestamps, y descartando duraciones menores a 5 o mayores a 90 minutos.

El criterio es no actuar sobre datos ruidosos: dos o tres consultas, o un cambio de estado mal registrado, no deberían mover la estimación del slot. El umbral de 10 registros y la banda 5–90 filtran el ruido estadístico y los errores operativos. Además, el médico nunca interactúa con el sistema para registrar tiempos: todo se deriva de los cambios de estado que hace el admin, así que la métrica es un subproducto de la operación normal y no captura de datos adicional.

### Walk-ins

Los walk-ins no usan slots ni bloquean tiempo en la agenda. Nacen en estado `WAITING` y se muestran como una cola separada; el admin decide cuándo mandarlos a consulta según los huecos naturales del día.

El criterio es que un walk-in es por definición no agendado. Meterlo en la grilla de slots generaría conflictos falsos o desplazaría a pacientes con cita. Mantenerlos en una cola paralela preserva la integridad de la agenda programada —la validación anti doble-agenda solo considera citas con hora— mientras el paciente en espera sigue visible para el médico.

### Cancelación

Pueden cancelar el admin y el doctor, siempre con una razón obligatoria. Cada cancelación genera un evento trazable en `appointment_events` con quién canceló, cuándo y por qué. No existe DELETE físico: las cancelaciones son una transición de estado vía `PATCH /status`.

El criterio es que en una clínica "por qué se canceló esto" es una pregunta operativa y a veces legal. Una transición suave con razón obligatoria conserva el historial completo y permite que el reporte del día cuente correctamente una cita cancelada y luego reagendada. Un borrado físico destruiría esa traza de auditoría.

### No-show

El admin hace check-in manual (`→ ARRIVED`) cuando el paciente llega. Si una cita no avanza a `ARRIVED` dentro de los 15 minutos posteriores a su hora programada, el sistema la marca automáticamente como `NO_SHOW`. El timer no aplica si la cita ya pasó a `IN_CONSULTATION` o un estado posterior, y un no-show automático puede revertirse manualmente por el admin (`NO_SHOW → SCHEDULED`). La acción automática registra el evento con `changed_by = null`.

El criterio es distinguir "el paciente no vino" de "el admin no actualizó la pantalla". La ventana de gracia de 15 minutos y la regla de que solo las citas en `SCHEDULED` son elegibles evitan castigar al paciente por el retraso de registro del admin. El `changed_by = null` deja el evento auditable y distinguible de una acción humana, y la reversión manual da control sobre el error de registro inevitable.

## Diagrama de datos

```mermaid
erDiagram
  doctors {
    uuid id PK
    varchar name
    varchar specialty
    int slot_duration
    int avg_duration
    boolean active
    timestamp created_at
  }
  users {
    uuid id PK
    varchar name
    varchar email
    varchar password_hash
    enum role
    uuid doctor_id FK
    timestamp created_at
  }
  patients {
    uuid id PK
    varchar name
    varchar phone
    varchar email
    text notes
    timestamp created_at
  }
  appointments {
    uuid id PK
    uuid doctor_id FK
    uuid patient_id FK
    uuid created_by FK
    uuid cancelled_by FK
    enum type
    enum status
    timestamp scheduled_at
    int slot_duration
    timestamp checkin_at
    timestamp started_at
    timestamp ended_at
    timestamp cancelled_at
    text cancel_reason
    timestamp created_at
    timestamp updated_at
  }
  appointment_events {
    uuid id PK
    uuid appointment_id FK
    uuid changed_by FK
    varchar from_status
    varchar to_status
    text reason
    timestamp created_at
  }

  doctors ||--o{ appointments : "atiende"
  doctors ||--o| users : "tiene cuenta"
  patients ||--o{ appointments : "agenda"
  users ||--o{ appointments : "crea"
  appointments ||--o{ appointment_events : "registra"
  users ||--o{ appointment_events : "ejecuta"
```

## Limitaciones conocidas

**Zona horaria UTC.** Los límites de día en `GET /api/appointments` y en el reporte diario se calculan con fronteras UTC (`${date}T00:00:00.000Z`). En una clínica con un offset marcadamente negativo (por ejemplo UTC-6), una cita de la tarde-noche puede caer en el día UTC siguiente y aparecer en la fecha equivocada o contarse en el reporte del día que no corresponde. Un despliegue fuera de UTC necesita una estrategia de zona horaria consistente: operar en la zona de la clínica o pasar un offset explícito en las consultas.

**Enumeración por timing en login.** El endpoint de login corta el `bcrypt.compare` cuando el email no existe, lo que produce una diferencia de tiempo medible entre "email desconocido" y "contraseña incorrecta". Eso permite enumerar usuarios válidos observando la latencia de la respuesta. La mitigación es ejecutar siempre una comparación bcrypt contra un hash dummy para igualar el tiempo de respuesta en ambos casos.
