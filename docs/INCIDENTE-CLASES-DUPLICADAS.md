# Incidente: créditos de clases descontados por duplicado

**Fecha de detección:** 2026-04-21
**Clientas reportadas afectadas:** Sonia Trejo, Tania Grant, Marcela Fernández Cruz, Montserrat Lenoyr.
**Severidad:** Alta — pérdida silenciosa de créditos pagados.

## Síntoma

Varias clientas reportaron que les desaparecían clases de su membresía sin haber hecho las reservas correspondientes.

Ejemplos:
- Sonia: plan de 12 clases, 5 reservas visibles, el sistema mostraba **0** restantes (debería ser 3).
- Marcela: plan de 12 clases, 5 reservas visibles, el sistema mostraba **0** restantes.
- Tania: tenía 2 créditos, pasó a 0 sin nueva reserva.

La pestaña "Reservas" del cliente en el admin mostraba menos reservas de las que correspondían al descuento.

## Causa raíz

Dos **triggers de PostgreSQL** legacy instalados desde [`supabase/migrations/schema_complete.sql`](../supabase/migrations/schema_complete.sql) duplicaban lo que el backend (`server/index.js`) ya hacía en código:

### Trigger 1: `trigger_decrement_classes` ([schema_complete.sql:1478-1494](../supabase/migrations/schema_complete.sql#L1478))

```sql
CREATE OR REPLACE FUNCTION decrement_membership_classes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'checked_in' AND NEW.status = 'checked_in' AND NEW.membership_id IS NOT NULL THEN
        UPDATE memberships
        SET classes_remaining = GREATEST(classes_remaining - 1, 0)
        WHERE id = NEW.membership_id
        AND classes_remaining IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_classes
    AFTER UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION decrement_membership_classes();
```

Cada vez que una reserva transicionaba a `checked_in`, el trigger restaba **1 crédito** automáticamente a nivel de base de datos.

### Trigger 2: `trigger_update_booking_count` ([schema_complete.sql:1497-1522](../supabase/migrations/schema_complete.sql#L1497))

Hacía lo mismo para `classes.current_bookings`: sumaba/restaba 1 al estado de ocupación de la clase en cada INSERT/UPDATE/DELETE.

### El conflicto

El backend ya implementa esa lógica manualmente:

- [`server/index.js:2685`](../server/index.js#L2685) — al crear reserva: `UPDATE memberships SET classes_remaining = classes_remaining - 1`.
- [`server/index.js:8903`](../server/index.js#L8903) — al asignar reserva desde admin: ídem.
- [`server/index.js:2679`](../server/index.js#L2679) y similares — incrementa `classes.current_bookings` al reservar.

## Ciclo de vida del bug

```
1. Clienta reserva una clase
   → app: classes_remaining -= 1     (-1)
   → trigger no dispara (INSERT, no UPDATE de status)

2. Admin marca check-in
   → app: UPDATE bookings SET status = 'checked_in'
   → trigger detecta transición → classes_remaining -= 1  (-1 extra)

Resultado: cada clase con check-in consumía 2 créditos en lugar de 1.
```

## Validación numérica

| Clienta  | Plan | Reservas | checked_in | Descuento real | Esperado restante | Mostrado | Match |
|----------|------|----------|------------|----------------|-------------------|----------|-------|
| Sonia    | 12   | 5        | 4          | 4·2 + 1 = 9    | 3                 | 0        | +3 de más |
| Marcela  | 12   | 5        | 5          | 5·2 = 10       | 2                 | 0        | +2 de más |
| Montserrat (nueva) | 8 | 1 | 1 | 1·2 = 2 | 6 | 7 | correcto† |

† Montserrat sólo tenía 1 booking en la membresía nueva, y era confirmada (no checked-in aún), por eso no se duplicó.

## Solución aplicada

### 1. Drop de los triggers ([server/index.js:953-957](../server/index.js#L953-L957))

Agregado en `ensureSchema()` (corre en cada arranque del servidor):

```js
await pool.query(`DROP TRIGGER IF EXISTS trigger_decrement_classes ON bookings`).catch(() => { });
await pool.query(`DROP FUNCTION IF EXISTS decrement_membership_classes() CASCADE`).catch(() => { });
await pool.query(`DROP TRIGGER IF EXISTS trigger_update_booking_count ON bookings`).catch(() => { });
await pool.query(`DROP FUNCTION IF EXISTS update_class_booking_count() CASCADE`).catch(() => { });
```

Commit: `e0f4eb6` — "fix: drop legacy DB triggers que duplicaban descuento de clases"

### 2. Audit log de cambios a `classes_remaining`

Se creó la tabla `membership_credit_log` y todos los puntos que mutan `classes_remaining` ahora registran la causa:

- Reserva creada (self-serve o admin) → `booking_created` / `admin_booking_assigned`
- Cancelación on-time → `booking_cancelled_ontime`
- Cancelación admin → `admin_booking_cancelled`
- Edición manual "Ajustar créditos" → `admin_manual_adjust`
- Reconciliación automática → `reconcile_from_bookings` / `bulk_reconcile_trigger_fix`

Consultar log de una membresía:

```
GET /api/memberships/:membershipId/credit-log
```

Commit: `4ef54ba` — "feat: audit log de cambios en classes_remaining + reconciliación"

### 3. Endpoints de reconciliación

**Individual (una membresía):**

```
GET /api/memberships/:id/credit-reconcile           → preview
GET /api/memberships/:id/credit-reconcile?apply=true → corrige
```

Respuesta:

```json
{
  "data": {
    "membershipId": "uuid",
    "classLimit": 12,
    "bookingsConsumed": 5,
    "currentClassesRemaining": 0,
    "expectedClassesRemaining": 7,
    "diff": 7,
    "applied": true
  }
}
```

**Masivo (todas las membresías activas):**

```
POST /api/admin/memberships/credit-reconcile-all?dryRun=true   → preview
POST /api/admin/memberships/credit-reconcile-all                → aplica
```

Usa esto **después** de que Railway haya deployeado el fix. El dry-run primero lista a todas las afectadas para validar.

## Pasos para el admin

1. **Esperar** a que Railway termine el deploy del commit `e0f4eb6` (el DROP de triggers corre en el arranque, es idempotente).
2. **Preview** del impacto con dry-run:
   ```
   POST https://<tu-dominio>/api/admin/memberships/credit-reconcile-all?dryRun=true
   ```
   Revisar la lista de `changes` — cada entrada dice `{userName, before, after, diff}`.
3. **Aplicar**:
   ```
   POST https://<tu-dominio>/api/admin/memberships/credit-reconcile-all
   ```
4. Cada corrección queda registrada en `membership_credit_log` con `reason = 'bulk_reconcile_trigger_fix'` y el admin que la disparó.

## Cómo evitar que vuelva a pasar

- El `ensureSchema()` corre en cada arranque del servidor. Los triggers están eliminados de forma idempotente — aun si alguien reaplica `schema_complete.sql`, el siguiente deploy los vuelve a borrar.
- Cualquier cambio futuro a `classes_remaining` deja rastro en `membership_credit_log`. Para diagnosticar cualquier "clase que desapareció":
  ```
  GET /api/memberships/:id/credit-log
  ```

## Qué NO fue la causa

Estas hipótesis se descartaron durante el diagnóstico:

- ❌ Cron/job silencioso: el único cron toca emails y WhatsApp, no créditos.
- ❌ Admin editando a mano: el dialog "Ajustar créditos" requiere click + confirmación explícita y ninguna admin lo había usado.
- ❌ Cancelación tardía oculta: se revisó, no había reservas canceladas ocultas en la pestaña Reservas (el UI no filtra cancelled).
- ❌ Migración del sistema anterior: hubiera afectado solo a las clientas migradas, no a clientas nuevas.

## Archivos tocados

- [`server/index.js`](../server/index.js) — ensureSchema (DROP triggers), audit log, reconciliación.
- Tabla nueva: `membership_credit_log`.
- Sin cambios de frontend necesarios.
