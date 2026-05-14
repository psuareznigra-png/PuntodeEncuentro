# Punto Activo - Centro de Entrenamiento

Bienvenido a **Punto Activo Centro de Entrenamiento**, la solución integral para la administración de tu gimnasio. Este sistema ha sido diseñado para ser intuitivo, estéticamente premium y completamente automatizado.

## 🚀 Características Principales

### 1. Gestión de Actividades y Turnos
- Creación, edición y control de estado (Activo/Inactivo).
- Control de cupos dinámico: No necesitas actualizar el cupo manualmente, el sistema lo calcula restando las inscripciones activas del cupo máximo.
- Regla: Un socio solo puede tener un turno activo por actividad.

### 2. Control Automático de Morosidad
- **Automatización Total**: El sistema marca automáticamente a un socio como MOROSO si la fecha actual supera su fecha de vencimiento.
- El control se ejecuta cada vez que el socio inicia sesión o el administrador consulta su estado.

### 3. Módulo de Pagos
- ASOCIADO POR ACTIVIDAD: Un socio puede estar al día en una actividad y moroso en otra.
- Flujo de Aprobación: Los pagos informados por el socio quedan PENDIENTES hasta que un administrador los aprueba.
- Actualización de Vencimiento: Al aprobar un pago, el sistema suma automáticamente 1 mes a la fecha de vencimiento y activa al socio.

### 4. Panel de Administrador (Dashboard)
- Visualización de ingresos totales y por actividad.
- Estadísticas de ocupación de turnos.
- Listado de socios morosos para acción rápida.

## 🛠️ Instrucciones de Uso

### Para el Administrador:
1. **Login**: Usa las credenciales de administrador.
2. **Actividades**: Desde el menú, puedes crear nuevas disciplinas y asignarles un precio y profesor.
3. **Turnos**: Define los horarios y cupos máximos para cada actividad activa.
4. **Pagos**: Revisa la sección de "Pagos Pendientes" para aprobar los comprobantes enviados por los socios.

### Para el Socio:
1. **Login**: Accede con tu cuenta.
2. **Inscripción**: Busca actividades disponibles y reserva tu lugar (siempre que haya cupo y no estés en mora).
3. **Pagos**: Desde "Reportar Pago", selecciona la actividad y adjunta tu comprobante.

## 💾 Estructura de Base de Datos (Normalizada)

El sistema está preparado para integrarse con **Supabase/PostgreSQL**. La estructura lógica es:

- **profiles**: id, nombre, email, rol (admin/socio).
- **activities**: id, nombre, profesor, precio, estado.
- **schedules**: id, actividad_id, dia, hora_inicio, hora_fin, cupo_maximo.
- **registrations**: id, usuario_id, turno_id, actividad_id, estado.
- **payments**: id, usuario_id, actividad_id, monto, metodo, estado_pago, fecha_reporte.
- **user_status**: usuario_id, actividad_id, ultimo_pago, fecha_vencimiento, estado.

## 🔧 Mantenimiento
- **Respaldo**: Al usar Supabase, los datos están respaldados en la nube.
- **Escalabilidad**: El código es modular. Puedes añadir nuevos métodos de pago o reportes estadísticos fácilmente en `app.js` y `data.js`.

---
*Desarrollado para Punto Activo - 2026*
