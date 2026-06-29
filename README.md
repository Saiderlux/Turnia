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

### ¿Cuánto dura una cita?

Slot fijo de 30 minutos por médico, configurable por el admin desde el panel. Este valor se copia al momento de crear la cita (campo `slotDuration` en `appointments`) para que cambios futuros no afecten citas ya agendadas.

Con suficientes datos históricos, el sistema calcula automáticamente la duración promedio real por médico usando los timestamps `started_at` y `ended_at` de cada consulta. El promedio se activa solo cuando el médico acumula mínimo 10 consultas con ambos timestamps completos, y excluye registros menores a 5 minutos o mayores a 90 (errores de registro). Mientras no se alcanza ese umbral, el sistema usa el slot fijo. El campo `avg_duration` en la tabla `doctors` refleja este valor y se recalcula automáticamente cada vez que una cita se marca como atendida.

El criterio detrás de esto: un promedio de 2 o 3 datos puede estar sesgado por consultas atípicas. 10 registros es el mínimo para que el promedio sea representativo sin requerir semanas de operación.

### ¿Cómo se valida un horario al agendar?

Al crear una cita el sistema aplica tres reglas en el backend (`appointment.service.ts`), no solo en la interfaz:

1. **Anti doble-agenda:** un médico no puede tener dos citas que se solapen. La verificación ignora las citas en estado `CANCELLED` y `NO_SHOW` — esos horarios quedan libres otra vez.
2. **Descanso de 10 minutos entre citas:** dos citas consecutivas del mismo médico exigen al menos 10 minutos entre el fin de una y el inicio de la siguiente. El médico no atiende back-to-back: necesita margen para cerrar una consulta y preparar la siguiente. Por eso el selector de hora ofrece los slots con cadencia `slotDuration + 10` (un médico de 30 min: 8:00, 8:40, 9:20…).
3. **No se agenda en el pasado:** se rechaza cualquier `scheduledAt` anterior al momento actual. En el selector, las horas ya pasadas aparecen deshabilitadas ("— pasado") y la fecha mínima es hoy.

Si una regla se incumple, la API responde con un mensaje legible (409 para conflicto o descanso, 400 para fecha pasada) que la interfaz muestra inline en el formulario, sin `alert()`.

El criterio: estas validaciones viven en el servicio para que ninguna ruta —ni un cliente que llame directo a la API— pueda saltárselas. La interfaz las refleja (slots deshabilitados, fecha mínima) como prevención de errores, pero la fuente de verdad es el backend.

### ¿Quién puede cancelar?

El admin y el doctor pueden cancelar. La cancelación siempre requiere una razón (campo obligatorio). Toda cancelación queda registrada en `appointment_events` con quién la ejecutó, cuándo y por qué — esto garantiza trazabilidad completa.

El criterio: quitarle el permiso al doctor crea un cuello de botella operativo (el doctor tiene una urgencia, el admin no está disponible, los pacientes esperan). El control está en la trazabilidad, no en el permiso. Si el doctor cancela, el admin lo ve inmediatamente en el registro de eventos.

### ¿Los walk-ins tienen su propio flujo o entran al mismo?

Los walk-ins tienen su propio carril. Se registran con `type: WALKIN` y nacen directamente en estado `WAITING` — nunca pasan por `SCHEDULED`. Aparecen en la agenda del médico como cola de espera separada, sin ocupar un slot de tiempo. El admin los canaliza con el médico cuando hay un hueco natural entre citas. Una vez que el admin los manda a consulta (transición a `IN_CONSULTATION`), el doctor los ve igual que cualquier cita.

El criterio: asignarles un slot fijo desplazaría citas ya agendadas o desperdiciaría tiempo si no llegan. La cola de espera separada permite absorberlos sin romper la agenda programada.

### ¿Qué significa "no llegó"?

Una cita se marca automáticamente como `NO_SHOW` si no ha pasado al estado `ARRIVED` dentro de los 15 minutos posteriores a su hora programada. Un cron job revisa esto cada minuto. El cambio queda registrado en `appointment_events` con `changedById: null`, que indica que fue el sistema y no un usuario quien lo ejecutó.

Si el admin olvidó hacer check-in pero el paciente ya está en consulta (estado `IN_CONSULTATION` o posterior), el timer no aplica — el cron solo toca citas que siguen en `SCHEDULED`.

Un no-show automático puede revertirse manualmente por el admin (transición `NO_SHOW → SCHEDULED`), una corrección reservada exclusivamente al admin para los errores de registro.

### Datos de demostración vs. datos hardcodeados

El seed incluye 8 médicos y 3 pacientes como datos de demostración para poder probar el sistema sin configuración adicional. Estos no son datos hardcodeados por diseño — el sistema permite registrar nuevos médicos y pacientes desde el panel admin sin tocar código ni base de datos.

La distinción es importante: un médico nuevo registrado desde el panel recibe automáticamente un usuario con credenciales temporales (contraseña: `turnia2024`) y queda disponible para agendar citas de inmediato. Un paciente nuevo se puede registrar en el mismo flujo de agendamiento, sin salir del modal de nueva cita.

Los datos del seed existen para que el evaluador pueda probar el flujo completo sin pasos previos de configuración. En un entorno real, el seed se reemplazaría por el primer usuario admin creado durante el onboarding.

## Log de decisiones

El proceso de decisión —cómo se interpretó el brief, qué alternativas se evaluaron y por qué se eligió cada camino— está en [`conversations.json`](./conversations.json): la exportación de la conversación de planeación, con timestamps reales (27–29 de junio de 2026).

Cubre las decisiones de producto y de modelado: la interpretación del caso, el flujo de walk-ins, la regla del promedio histórico, el modelo de datos y el ERD, los tres casos de error visibles y el alcance que se priorizó. Las convenciones técnicas que guiaron la implementación quedaron en [`CLAUDE.md`](./CLAUDE.md), y el porqué de cada cambio posterior está en los mensajes de commit del historial de git.

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
