# Stock de alimento — diseño

Aprobado en conversación el 2026-09-28. Pedido del cliente principal: "una pestaña para control de Stock de Alimento".

## Decisiones

- Consumo cargado **a mano** en cada entrega (sin ración automática).
- Extras: **aviso de stock bajo**, **precio de compra** (gasto por mes), **días de reserva**.
- Enfoque: **catálogo + movimientos**. El stock nunca se guarda: se calcula sumando movimientos, así editar o borrar uno corrige el stock.

## Datos

Colecciones nuevas en la API genérica (`/api/db`), con permisos por campo como el resto (owner/editor escriben, viewer lee):

**`alimentos`**
| campo | tipo | notas |
|---|---|---|
| campoId | string | |
| nombre | string | "Alfalfa", "Maíz" |
| unidad | string | fardos, rollos, kg, bolsas u otra (texto libre) |
| stockMinimo | number | 0 = sin aviso |
| activo | boolean | archivar sin perder movimientos |
| createdAt | timestamp | |

**`alimentoMovimientos`**
| campo | tipo | notas |
|---|---|---|
| campoId, alimentoId | string | |
| tipo | `ingreso` \| `consumo` \| `ajuste` | |
| cantidad | number | ingreso/consumo: positiva. ajuste: diferencia con signo |
| conteo | number | solo ajuste: lo que se contó |
| fecha | timestamp | mediodía UTC del día elegido (como el resto de la app) |
| precioTotal | number \| null | solo ingreso, opcional |
| nota | string | |
| createdAt, updatedAt | timestamp | |

## Cálculos (`src/lib/alimento.js`, funciones puras)

- `calcularStock(movs)` = Σ ingreso − Σ consumo + Σ ajuste.
- `consumoPromedioDiario(movs, hoy)` = Σ consumos de los últimos 28 días ÷ ventana, donde ventana = días desde el primer movimiento, acotada a [1, 28] (evita subestimar el consumo de un alimento nuevo).
- `diasDeReserva(stock, promedio)` = `floor(stock / promedio)`; `null` si promedio ≤ 0; 0 si stock ≤ 0.
- `gastosPorMes(movs, hoy, meses = 6)` = por mes `YYYY-MM`, suma de `precioTotal` de ingresos; incluye meses en 0.
- `deltaAjuste(stockActual, conteo)` = conteo − stockActual.
- `stockBajo(stock, minimo)` = minimo > 0 && stock ≤ minimo.

## Interfaz

- Ruta `/app/alimento`, entrada "Alimento" en el menú y acceso directo "Registrar alimento" (`?nuevo=consumo`).
- **Stock**: tarjeta por alimento activo con stock, unidad, días de reserva, aviso "Stock bajo", botones + Ingreso / − Consumo / Ajustar. "Nuevo alimento" arriba; editar/archivar desde la tarjeta.
- **Movimientos**: lista por fecha descendente, filtro por alimento, editar y borrar.
- **Gastos**: tabla de los últimos 6 meses con total por mes.
- Consumo que deja stock negativo: confirmación, no bloqueo.
- **Dashboard**: alerta "Stock bajo: Alfalfa — quedan 3 fardos (mínimo 10)" por cada alimento en falta.

## Pruebas

- Unitarias de los cálculos (casos borde: sin movimientos, alimento nuevo, ajustes negativos, meses sin compras).
- Permisos de las colecciones nuevas (aislamiento entre campos, viewer solo lee).
- Navegador en local con datos reales; deploy y verificación en producción.
