# Stock de alimento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla para controlar el stock de alimento por campo: ingresos con precio, consumos manuales, ajustes por conteo, días de reserva, gasto mensual y aviso de stock bajo.

**Architecture:** Dos colecciones nuevas en la API genérica existente (`alimentos`, `alimentoMovimientos`). El stock se calcula en el navegador con funciones puras (`src/lib/alimento.js`). Página nueva `src/pages/Alimento.jsx` con el shim de Firestore, como el resto de las páginas.

**Tech Stack:** React 18 + Vite, shim `src/lib/db.js`, servidor Express + node:sqlite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-stock-alimento-design.md`

## Global Constraints

- Permisos por campo del servidor: owner/editor escriben, viewer lee; `campoId` inmutable.
- Fechas como mediodía UTC del día elegido (`dateFromInput`), igual que el resto de la app.
- Borrados van a `deleted_docs` (recuperables).
- No tocar datos existentes; las colecciones nuevas arrancan vacías.

---

### Task 1: Permitir las colecciones nuevas en el servidor

**Files:** Modify `server/src/routes/data.js` (`CAMPO_COLLECTIONS`); Test `server/test/data.test.js`.

- [ ] Test: owner crea `alimentos` y `alimentoMovimientos` en su campo; otro campo recibe 403; viewer recibe 403 al escribir.
- [ ] Agregar `'alimentos', 'alimentoMovimientos'` al Set. Tests en verde. Commit.

### Task 2: Cálculos puros

**Files:** Create `src/lib/alimento.js`; Test `server/test/alimento.test.js`.

**Produces:** `calcularStock(movs) → number`, `consumoPromedioDiario(movs, hoy, dias = 28) → number`, `diasDeReserva(stock, promedio) → number | null`, `gastosPorMes(movs, hoy, meses = 6) → [{ mes: 'YYYY-MM', total }]`, `deltaAjuste(stock, conteo) → number`, `stockBajo(stock, minimo) → boolean`, `redondear(n) → number`. Las fechas aceptan Timestamp del shim (`toDate()`) o `Date`.

- [ ] Tests de casos: sin movimientos; ingreso+consumo+ajuste negativo; alimento con 5 días de historia (ventana 5, no 28); consumos fuera de la ventana; meses sin compras en 0; ingreso sin precio.
- [ ] Implementar. Tests en verde. Commit.

### Task 3: Página Alimento

**Files:** Create `src/pages/Alimento.jsx`, `src/pages/Alimento.css`; Modify `src/App.jsx` (ruta), `src/components/Header.jsx` (menú + acceso directo), `src/pages/Dashboard.jsx` (alertas de stock bajo).

- [ ] Solapas Stock / Movimientos / Gastos; modales Nuevo/Editar alimento y Movimiento (ingreso, consumo, ajuste) con editar/borrar.
- [ ] `?nuevo=consumo` abre el modal de consumo; `?nuevo=alimento` el de nuevo alimento.
- [ ] Dashboard: una alerta por alimento activo en stock bajo, con link a `/app/alimento`.
- [ ] `npm run build` OK. Prueba en navegador local con copia de datos: crear alimento, ingreso con precio, consumo, ajuste, editar/borrar movimiento, stock bajo en Dashboard, celular. Commit.

### Task 4: Deploy

- [ ] `./deploy/deploy.sh`; verificar que el bundle de producción tiene la página nueva.
