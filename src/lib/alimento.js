// Cálculos del stock de alimento. El stock no se guarda: sale de sumar los
// movimientos (ingreso, consumo, ajuste), así editar o borrar uno lo corrige solo.

const DIA_MS = 86_400_000;

function aDate(fecha) {
  if (!fecha) return null;
  return fecha.toDate ? fecha.toDate() : new Date(fecha);
}

// Días calendario (UTC) desde el epoch. Las fechas se guardan a mediodía UTC.
function diaUTC(date) {
  return Math.floor(date.getTime() / DIA_MS);
}

export function redondear(n, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

export function calcularStock(movimientos) {
  let stock = 0;
  for (const m of movimientos) {
    const cantidad = Number(m.cantidad) || 0;
    if (m.tipo === 'ingreso') stock += cantidad;
    else if (m.tipo === 'consumo') stock -= cantidad;
    else if (m.tipo === 'ajuste') stock += cantidad;
  }
  return redondear(stock);
}

// Consumo por día de las últimas `dias` jornadas. Si el alimento tiene menos
// historia, divide por los días que lleva (si no, subestimaría el consumo).
export function consumoPromedioDiario(movimientos, hoy = new Date(), dias = 28) {
  const fechas = movimientos.map((m) => aDate(m.fecha)).filter(Boolean);
  if (!fechas.length) return 0;
  const hoyDia = diaUTC(hoy);
  const primerDia = Math.min(...fechas.map(diaUTC));
  const ventana = Math.min(Math.max(hoyDia - primerDia, 1), dias);
  const desde = hoyDia - ventana;

  const total = movimientos
    .filter((m) => m.tipo === 'consumo')
    .filter((m) => {
      const d = aDate(m.fecha);
      return d && diaUTC(d) >= desde && diaUTC(d) <= hoyDia;
    })
    .reduce((sum, m) => sum + (Number(m.cantidad) || 0), 0);
  return redondear(total / ventana);
}

export function diasDeReserva(stock, promedioDiario) {
  if (stock <= 0) return 0;
  if (!promedioDiario || promedioDiario <= 0) return null;
  return Math.floor(stock / promedioDiario);
}

function mesClave(date) {
  return date.toISOString().slice(0, 7);
}

// Gasto en compras de los últimos `meses` meses (incluido el actual), del más viejo al más nuevo.
export function gastosPorMes(movimientos, hoy = new Date(), meses = 6) {
  const claves = [];
  for (let i = meses - 1; i >= 0; i--) {
    claves.push(mesClave(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 15))));
  }
  const totales = Object.fromEntries(claves.map((k) => [k, 0]));
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' || !m.precioTotal) continue;
    const d = aDate(m.fecha);
    const clave = d && mesClave(d);
    if (clave in totales) totales[clave] += Number(m.precioTotal) || 0;
  }
  return claves.map((mes) => ({ mes, total: redondear(totales[mes]) }));
}

export function deltaAjuste(stockActual, conteo) {
  return redondear(conteo - stockActual);
}

export function stockBajo(stock, minimo) {
  return Number(minimo) > 0 && stock <= Number(minimo);
}
