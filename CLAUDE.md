# CLAUDE.md

## Stack
- Node.js + Express + TypeScript (strict: true)
- Prisma ORM con PostgreSQL
- JWT para auth
- node-cron para jobs

## Convenciones
- Todos los errores del dominio se lanzan como instancias de clases custom en src/utils/errors.ts
- Las respuestas de error siguen el formato: { error: { code, message, details? } }
- Las queries a BD van siempre a través de Prisma — sin SQL raw excepto donde se documente explícitamente
- Los campos de tipo password nunca se incluyen en respuestas de la API
- Los enums de TypeScript deben coincidir exactamente con los enums de Prisma

## Reglas de negocio críticas
- La validación de transiciones de estado vive en src/services/appointment.service.ts
- El job de no-show usa changed_by = null para marcar acciones automáticas del sistema
- La duración promedio solo se calcula cuando el doctor tiene >= 10 registros entre 5 y 90 minutos

## Lo que NO hacer
- No usar alert() ni console.error como manejo de errores visible al usuario
- No hardcodear credenciales ni UUIDs de seed en lógica de negocio
- No crear endpoints DELETE — las cancelaciones van por PATCH /status
