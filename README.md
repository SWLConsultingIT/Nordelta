# Nordelta Operations Platform

Plataforma interna de operaciones y cuentas corrientes multi-moneda.
Reemplaza el sistema actual de Google Sheets + Apps Script + BigQuery + n8n.

## Estado

Front completo. Corre con datos de muestra hasta que se configure Supabase.

| Pantalla | Ruta | Estado |
|---|---|---|
| Landing | `/` | Lista |
| Ingreso | `/login` | Lista — Supabase Auth cableado, con modo demo |
| Inicio | `/inicio` | Lista |
| Carga diaria | `/carga` | Lista — grilla editable, pegado desde Excel |
| Contrapartes | `/cuentas` | Lista |
| Cuenta corriente | `/cuentas/[id]` | Lista — saldo corrido y cierres |
| Balance general | `/balance` | Lista |
| Ajustes de cuenta | `/ajustes` | Lista — calcula el ajuste que cierra la cuenta |
| Auditoría | `/auditoria` | Lista |
| Export CSV | `/api/export` | Listo — balance, cuenta corriente y caja diaria |

## Correr

```bash
npm install
npm run dev          # http://localhost:3000
npm run verificar    # reglas de negocio contra el comportamiento de producción
npm run build
```

Sin variables de entorno la app usa las fixtures de `src/lib/data/fixtures.ts`.
Para conectar Supabase, copiá `.env.example` a `.env.local` y completá las claves.

## Arquitectura

```
src/lib/domain/     Reglas de negocio. Verificadas contra el SQL de producción.
src/lib/data/       Único punto de acceso a datos. La costura Supabase vive acá.
src/lib/supabase/   Clientes de navegador y servidor.
src/components/     UI. `grid/` es la grilla de carga.
supabase/migrations Esquema, vistas y RLS.
```

**La lógica financiera no vive en el front.** `src/lib/domain/fx.ts` calcula
para dar respuesta inmediata en la grilla, pero la autoridad son las columnas
generadas `partidas.moneda_impacto` y `partidas.monto_impacto`. Si las dos
discrepan, la base tiene razón.

## El modelo: movimiento + partidas

Una fila de la planilla actual lleva hasta **nueve montos** en dieciséis
columnas, con **dos tipos de cambio independientes** — uno para la pata en
efectivo y otro para la pata de transferencia. El modelo plano de un monto por
fila no representa eso, así que un movimiento tiene N partidas y cada partida
resuelve su moneda de impacto por separado.

Eso no es solo prolijidad: **hace imposible el bug 5 del sistema actual**, donde
una fila que mezcla una pata convertida con una pata en pesos sin convertir
pierde la segunda del saldo. Ver `npm run verificar`.

## Reglas verificadas contra producción

- **Qué impacta la cuenta corriente:** ingresos, pagos a proveedores, full pagos
  y ajustes. Compras, ventas e impuestos no. (`ALLOWED_SECTIONS` del Apps Script.)
- **Conversión:** la comisión se aplica *antes* de dividir por el tipo de cambio,
  y solo a las patas de transferencia.
- **Cierre de cuenta:** las cuatro monedas en cero *simultáneamente*, redondeadas
  a dos decimales, con la posición anterior distinta de cero.
- **Signo:** no hay lógica de signo; los egresos se cargan en negativo.

## Pendiente de definición del negocio

Hay 21 preguntas abiertas, tres de ellas bloqueantes para cerrar el esquema.
La más importante: si el asiento espejo del proveedor de transferencia —presente
en el consolidado 2025 y ausente en el de 2026— sigue vigente. Si sigue vivo, un
movimiento necesita poder referenciar dos contrapartes.

## Notas de implementación

- El pegado de rangos desde Excel es una feature *Enterprise* de AG Grid, así que
  está implementado a mano sobre AG Grid Community en `CargaGrid.tsx`.
- La grilla usa una fila por partida. Falta validarlo con la gente que carga,
  cronómetro en mano contra el Sheet actual.
