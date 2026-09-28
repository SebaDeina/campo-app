import { useEffect, useMemo, useState } from 'react';
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc,
} from '../lib/db';
import { db } from '../firebase/config';
import { useCampo } from '../firebase/CampoContext';
import { useNuevoParam } from '../lib/useNuevoParam';
import {
  calcularStock, consumoPromedioDiario, diasDeReserva, gastosPorMes, deltaAjuste, stockBajo, redondear,
} from '../lib/alimento';
import { Plus, Minus, Edit2, Trash2, X, Scale, Archive, RotateCcw, Wheat } from 'lucide-react';
import './Alimento.css';

const UNIDADES = ['fardos', 'rollos', 'kg', 'bolsas', 'litros'];

const TIPOS = {
  ingreso: { label: 'Ingreso', titulo: 'Registrar ingreso', color: 'ingreso' },
  consumo: { label: 'Consumo', titulo: 'Registrar consumo', color: 'consumo' },
  ajuste: { label: 'Ajuste', titulo: 'Ajustar por conteo', color: 'ajuste' },
};

const hoyInput = () => new Date().toISOString().split('T')[0];

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

function inputFromDate(fecha) {
  if (!fecha) return hoyInput();
  const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return date.toISOString().split('T')[0];
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const formatCantidad = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const formatPlata = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function formatMes(clave) {
  const [year, month] = clave.split('-').map(Number);
  const nombre = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${year}`;
}

const ALIMENTO_VACIO = { nombre: '', unidad: 'fardos', stockMinimo: '' };

function textoReserva({ stock, dias }) {
  if (stock <= 0) return 'Sin stock';
  if (dias === null) return 'Sin consumos recientes';
  if (dias < 1) return 'Alcanza para menos de 1 día';
  return `Alcanza para ~${dias} día${dias === 1 ? '' : 's'}`;
}

const aMillis = (f) => (f ? (f.toMillis ? f.toMillis() : new Date(f).getTime()) : 0);

// Más nuevos primero; dentro del mismo día, el último cargado arriba.
function ordenarMovimientos(movs) {
  return [...movs].sort((a, b) => aMillis(b.fecha) - aMillis(a.fecha) || aMillis(b.createdAt) - aMillis(a.createdAt));
}

export default function Alimento() {
  const { selectedCampoId, loadingCampos } = useCampo();
  const [alimentos, setAlimentos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState('stock');
  const [filtroAlimento, setFiltroAlimento] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);

  // Modal de alimento: { id: null | string, form }
  const [alimentoModal, setAlimentoModal] = useState(null);
  // Modal de movimiento: { id: null | string, form: { alimentoId, tipo, fecha, cantidad, conteo, precioTotal, nota } }
  const [movModal, setMovModal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedCampoId) {
      setAlimentos([]);
      setMovimientos([]);
      setLoading(false);
      return;
    }
    loadTodo(selectedCampoId);
  }, [selectedCampoId]);

  async function loadTodo(campoId) {
    try {
      const [alimentosSnap, movsSnap] = await Promise.all([
        getDocs(query(collection(db, 'alimentos'), where('campoId', '==', campoId))),
        getDocs(query(collection(db, 'alimentoMovimientos'), where('campoId', '==', campoId), orderBy('fecha', 'desc'))),
      ]);
      const lista = alimentosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setAlimentos(lista);
      setMovimientos(ordenarMovimientos(movsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    } catch (error) {
      console.error('Error cargando alimento:', error);
    } finally {
      setLoading(false);
    }
  }

  const resumen = useMemo(() => {
    const hoy = new Date();
    return Object.fromEntries(alimentos.map((a) => {
      const movs = movimientos.filter((m) => m.alimentoId === a.id);
      const stock = calcularStock(movs);
      const promedio = consumoPromedioDiario(movs, hoy);
      return [a.id, { stock, promedio, dias: diasDeReserva(stock, promedio), bajo: stockBajo(stock, a.stockMinimo) }];
    }));
  }, [alimentos, movimientos]);

  const activos = alimentos.filter((a) => a.activo !== false);
  const archivados = alimentos.filter((a) => a.activo === false);
  const alimentoPorId = Object.fromEntries(alimentos.map((a) => [a.id, a]));
  const gastos = useMemo(() => gastosPorMes(movimientos, new Date(), 6), [movimientos]);
  const movimientosFiltrados = filtroAlimento
    ? movimientos.filter((m) => m.alimentoId === filtroAlimento)
    : movimientos;

  // --- Alimentos ---

  function openNuevoAlimento() {
    setAlimentoModal({ id: null, form: { ...ALIMENTO_VACIO } });
  }

  function openEditarAlimento(alimento) {
    setAlimentoModal({
      id: alimento.id,
      form: { nombre: alimento.nombre, unidad: alimento.unidad, stockMinimo: alimento.stockMinimo || '' },
    });
  }

  async function handleAlimentoSubmit(e) {
    e.preventDefault();
    const { id, form } = alimentoModal;
    const data = {
      nombre: form.nombre.trim(),
      unidad: form.unidad.trim() || 'unidades',
      stockMinimo: form.stockMinimo === '' ? 0 : Number(form.stockMinimo),
    };
    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'alimentos', id), { ...data, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, 'alimentos'), { ...data, campoId: selectedCampoId, activo: true, createdAt: new Date() });
      }
      setAlimentoModal(null);
      loadTodo(selectedCampoId);
    } catch (error) {
      alert(error.message || 'No se pudo guardar el alimento');
    } finally {
      setSaving(false);
    }
  }

  async function setActivo(alimento, activo) {
    const pregunta = activo
      ? `¿Reactivar "${alimento.nombre}"?`
      : `¿Archivar "${alimento.nombre}"? Deja de aparecer en el stock, pero sus movimientos se conservan.`;
    if (!window.confirm(pregunta)) return;
    try {
      await updateDoc(doc(db, 'alimentos', alimento.id), { activo, updatedAt: new Date() });
      loadTodo(selectedCampoId);
    } catch (error) {
      alert(error.message || 'No se pudo actualizar el alimento');
    }
  }

  // --- Movimientos ---

  function openMovimiento(tipo, alimentoId) {
    if (!activos.length) {
      openNuevoAlimento();
      return;
    }
    setMovModal({
      id: null,
      form: {
        alimentoId: alimentoId || activos[0].id,
        tipo,
        fecha: hoyInput(),
        cantidad: '',
        conteo: '',
        precioTotal: '',
        nota: '',
      },
    });
  }

  function openEditarMovimiento(mov) {
    setMovModal({
      id: mov.id,
      form: {
        alimentoId: mov.alimentoId,
        tipo: mov.tipo,
        fecha: inputFromDate(mov.fecha),
        cantidad: mov.tipo === 'ajuste' ? '' : String(mov.cantidad ?? ''),
        conteo: mov.tipo === 'ajuste' ? String(mov.conteo ?? '') : '',
        precioTotal: mov.precioTotal ? String(mov.precioTotal) : '',
        nota: mov.nota || '',
      },
    });
  }

  function updateMovForm(field, value) {
    setMovModal((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }));
  }

  // Stock del alimento sin contar el movimiento que se está editando.
  function stockSinMovimiento(alimentoId, movimientoId) {
    return calcularStock(movimientos.filter((m) => m.alimentoId === alimentoId && m.id !== movimientoId));
  }

  async function handleMovimientoSubmit(e) {
    e.preventDefault();
    const { id, form } = movModal;
    const alimento = alimentoPorId[form.alimentoId];
    const base = stockSinMovimiento(form.alimentoId, id);

    let cantidad;
    let extra = {};
    if (form.tipo === 'ajuste') {
      const conteo = Number(form.conteo);
      cantidad = deltaAjuste(base, conteo);
      extra = { conteo };
    } else {
      cantidad = redondear(Number(form.cantidad));
      if (!(cantidad > 0)) {
        alert('La cantidad tiene que ser mayor a cero.');
        return;
      }
    }

    if (form.tipo === 'consumo' && base - cantidad < 0) {
      const ok = window.confirm(
        `Con este consumo el stock de ${alimento.nombre} queda en ${formatCantidad(base - cantidad)} ${alimento.unidad}. ¿Guardar igual? Después podés ajustarlo por conteo.`,
      );
      if (!ok) return;
    }

    const data = {
      alimentoId: form.alimentoId,
      tipo: form.tipo,
      cantidad,
      fecha: dateFromInput(form.fecha),
      precioTotal: form.tipo === 'ingreso' && form.precioTotal !== '' ? Number(form.precioTotal) : null,
      nota: form.nota.trim(),
      ...extra,
    };

    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'alimentoMovimientos', id), { ...data, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, 'alimentoMovimientos'), { ...data, campoId: selectedCampoId, createdAt: new Date() });
      }
      setMovModal(null);
      loadTodo(selectedCampoId);
    } catch (error) {
      alert(error.message || 'No se pudo guardar el movimiento');
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminarMovimiento(mov) {
    const alimento = alimentoPorId[mov.alimentoId];
    const desc = `${TIPOS[mov.tipo]?.label || mov.tipo} de ${formatCantidad(Math.abs(mov.cantidad))} ${alimento?.unidad || ''} (${formatFecha(mov.fecha)})`;
    if (!window.confirm(`¿Borrar ${desc}? El stock se recalcula.`)) return;
    try {
      await deleteDoc(doc(db, 'alimentoMovimientos', mov.id));
      loadTodo(selectedCampoId);
    } catch (error) {
      alert(error.message || 'No se pudo borrar el movimiento');
    }
  }

  // Accesos directos: ?nuevo=consumo | ?nuevo=ingreso | ?nuevo=alimento
  useNuevoParam((nuevo) => {
    if (nuevo === 'alimento') openNuevoAlimento();
    else if (TIPOS[nuevo]) openMovimiento(nuevo);
  }, !loading);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      setMovModal(null);
      setAlimentoModal(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loadingCampos || loading) {
    return (
      <div className="container">
        <div className="loading">Cargando alimento...</div>
      </div>
    );
  }

  if (!selectedCampoId) {
    return (
      <div className="container">
        <div className="card">Seleccioná un campo para ver su stock de alimento.</div>
      </div>
    );
  }

  const movAlimento = movModal && alimentoPorId[movModal.form.alimentoId];
  const movBase = movModal ? stockSinMovimiento(movModal.form.alimentoId, movModal.id) : 0;

  return (
    <div className="container">
      <div className="alimento-header">
        <div>
          <h1 style={{ margin: 0 }}>Stock de Alimento</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
            Ingresos, consumos y cuánto te queda de cada alimento.
          </p>
        </div>
        <div className="alimento-header-actions">
          <button className="btn alimento-btn-consumo" onClick={() => openMovimiento('consumo')}>
            <Minus size={18} /> Registrar consumo
          </button>
          <button className="btn btn-primary" onClick={openNuevoAlimento} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nuevo alimento
          </button>
        </div>
      </div>

      <div className="ovejas-tabs">
        <button className={`tab-btn ${vista === 'stock' ? 'active' : ''}`} onClick={() => setVista('stock')}>Stock</button>
        <button className={`tab-btn ${vista === 'movimientos' ? 'active' : ''}`} onClick={() => setVista('movimientos')}>
          Movimientos ({movimientos.length})
        </button>
        <button className={`tab-btn ${vista === 'gastos' ? 'active' : ''}`} onClick={() => setVista('gastos')}>Gastos</button>
      </div>

      {vista === 'stock' && (
        activos.length === 0 ? (
          <div className="card alimento-vacio">
            <Wheat size={40} />
            <p>Todavía no cargaste alimentos.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Creá uno por cada cosa que guardás (ej: Alfalfa en fardos, Maíz en kg) y registrá lo que entra y lo que se consume.
            </p>
            <button className="btn btn-primary" onClick={openNuevoAlimento}>Crear el primero</button>
          </div>
        ) : (
          <div className="alimento-grid">
            {activos.map((a) => {
              const r = resumen[a.id];
              return (
                <div key={a.id} className={`card alimento-card ${r.bajo ? 'alimento-card-bajo' : ''}`}>
                  <div className="alimento-card-top">
                    <div>
                      <h3 className="alimento-nombre">{a.nombre}</h3>
                      {r.bajo && <span className="badge badge-stock-bajo">Stock bajo</span>}
                    </div>
                    <div className="alimento-card-tools">
                      <button className="icon-btn" title="Editar alimento" aria-label="Editar alimento" onClick={() => openEditarAlimento(a)}>
                        <Edit2 size={15} />
                      </button>
                      <button className="icon-btn" title="Archivar" aria-label="Archivar alimento" onClick={() => setActivo(a, false)}>
                        <Archive size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="alimento-stock">
                    <span className="alimento-stock-valor">{formatCantidad(r.stock)}</span>
                    <span className="alimento-stock-unidad">{a.unidad}</span>
                  </div>
                  <div className="alimento-meta">
                    <span>{textoReserva(r)}</span>
                    {r.promedio > 0 && <span>Consumo: {formatCantidad(r.promedio)} {a.unidad}/día</span>}
                    {a.stockMinimo > 0 && <span>Mínimo: {formatCantidad(a.stockMinimo)} {a.unidad}</span>}
                  </div>
                  <div className="alimento-card-actions">
                    <button className="btn btn-small alimento-btn-ingreso" onClick={() => openMovimiento('ingreso', a.id)}>
                      <Plus size={15} /> Ingreso
                    </button>
                    <button className="btn btn-small alimento-btn-consumo" onClick={() => openMovimiento('consumo', a.id)}>
                      <Minus size={15} /> Consumo
                    </button>
                    <button className="btn btn-small alimento-btn-ajuste" onClick={() => openMovimiento('ajuste', a.id)} title="Corregir el stock con lo que contaste">
                      <Scale size={15} /> Ajustar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {vista === 'stock' && archivados.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-small" style={{ background: 'var(--border)' }} onClick={() => setVerArchivados((v) => !v)}>
            {verArchivados ? 'Ocultar' : 'Ver'} archivados ({archivados.length})
          </button>
          {verArchivados && (
            <div className="card" style={{ marginTop: '10px' }}>
              {archivados.map((a) => (
                <div key={a.id} className="alimento-archivado">
                  <span>{a.nombre} · {formatCantidad(resumen[a.id].stock)} {a.unidad}</span>
                  <button className="btn btn-small" onClick={() => setActivo(a, true)}>
                    <RotateCcw size={14} /> Reactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === 'movimientos' && (
        <div className="card table-scroll">
          <div className="alimento-filtro">
            <label htmlFor="filtro-alimento">Alimento</label>
            <select id="filtro-alimento" value={filtroAlimento} onChange={(e) => setFiltroAlimento(e.target.value)}>
              <option value="">Todos</option>
              {alimentos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          {movimientosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px' }}>No hay movimientos.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Alimento</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th className="col-hide-mobile">Precio</th>
                  <th className="col-hide-mobile">Nota</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m) => {
                  const a = alimentoPorId[m.alimentoId];
                  const signo = m.tipo === 'consumo' ? '−' : m.cantidad < 0 ? '−' : '+';
                  return (
                    <tr key={m.id}>
                      <td>{formatFecha(m.fecha)}</td>
                      <td>{a?.nombre || '—'}</td>
                      <td><span className={`badge badge-mov-${m.tipo}`}>{TIPOS[m.tipo]?.label || m.tipo}</span></td>
                      <td>
                        <strong>{signo}{formatCantidad(Math.abs(m.cantidad))}</strong> {a?.unidad}
                        {m.tipo === 'ajuste' && m.conteo !== undefined && (
                          <div className="alimento-sub">Conteo: {formatCantidad(m.conteo)}</div>
                        )}
                      </td>
                      <td className="col-hide-mobile">
                        {m.precioTotal ? (
                          <>
                            {formatPlata(m.precioTotal)}
                            {m.cantidad > 0 && <div className="alimento-sub">{formatPlata(m.precioTotal / m.cantidad)} c/u</div>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="col-hide-mobile">{m.nota || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn" title="Editar" aria-label="Editar movimiento" onClick={() => openEditarMovimiento(m)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="icon-btn icon-btn-danger" title="Borrar" aria-label="Borrar movimiento" onClick={() => handleEliminarMovimiento(m)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {vista === 'gastos' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Gasto en alimento por mes</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: 0 }}>
            Suma de los precios cargados en los ingresos de los últimos 6 meses.
          </p>
          <table className="table">
            <tbody>
              {[...gastos].reverse().map((g) => (
                <tr key={g.mes}>
                  <td>{formatMes(g.mes)}</td>
                  <td style={{ textAlign: 'right' }}><strong>{g.total ? formatPlata(g.total) : '—'}</strong></td>
                </tr>
              ))}
              <tr className="alimento-total">
                <td>Total 6 meses</td>
                <td style={{ textAlign: 'right' }}>{formatPlata(gastos.reduce((s, g) => s + g.total, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {alimentoModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setAlimentoModal(null)}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{alimentoModal.id ? 'Editar alimento' : 'Nuevo alimento'}</h2>
              <button onClick={() => setAlimentoModal(null)} className="close-btn"><X size={24} /></button>
            </div>
            <form onSubmit={handleAlimentoSubmit}>
              <div className="input-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={alimentoModal.form.nombre}
                  onChange={(e) => setAlimentoModal((p) => ({ ...p, form: { ...p.form, nombre: e.target.value } }))}
                  placeholder="Ej: Alfalfa"
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Unidad *</label>
                <input
                  type="text"
                  list="alimento-unidades"
                  value={alimentoModal.form.unidad}
                  onChange={(e) => setAlimentoModal((p) => ({ ...p, form: { ...p.form, unidad: e.target.value } }))}
                  required
                />
                <datalist id="alimento-unidades">
                  {UNIDADES.map((u) => <option key={u} value={u} />)}
                </datalist>
              </div>
              <div className="input-group">
                <label>Stock mínimo (aviso)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={alimentoModal.form.stockMinimo}
                  onChange={(e) => setAlimentoModal((p) => ({ ...p, form: { ...p.form, stockMinimo: e.target.value } }))}
                  placeholder="Ej: 10. Vacío = sin aviso"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setAlimentoModal(null)} className="btn" style={{ flex: 1, background: 'var(--border)' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movModal && movAlimento && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setMovModal(null)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {movModal.id ? `Editar ${TIPOS[movModal.form.tipo].label.toLowerCase()}` : TIPOS[movModal.form.tipo].titulo}
              </h2>
              <button onClick={() => setMovModal(null)} className="close-btn"><X size={24} /></button>
            </div>
            <form onSubmit={handleMovimientoSubmit}>
              <div className="alimento-tipo-selector">
                {Object.entries(TIPOS).map(([tipo, t]) => (
                  <button
                    key={tipo}
                    type="button"
                    className={`alimento-tipo alimento-tipo-${t.color} ${movModal.form.tipo === tipo ? 'active' : ''}`}
                    onClick={() => updateMovForm('tipo', tipo)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="input-group">
                <label>Alimento *</label>
                <select value={movModal.form.alimentoId} onChange={(e) => updateMovForm('alimentoId', e.target.value)} required>
                  {(movModal.id ? alimentos : activos).map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.unidad})</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Stock {movModal.id ? 'sin este movimiento' : 'actual'}: {formatCantidad(movBase)} {movAlimento.unidad}
                </small>
              </div>
              <div className="input-group">
                <label>Fecha *</label>
                <input type="date" value={movModal.form.fecha} onChange={(e) => updateMovForm('fecha', e.target.value)} required />
              </div>
              {movModal.form.tipo === 'ajuste' ? (
                <div className="input-group">
                  <label>¿Cuánto contaste? ({movAlimento.unidad}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={movModal.form.conteo}
                    onChange={(e) => updateMovForm('conteo', e.target.value)}
                    required
                  />
                  {movModal.form.conteo !== '' && (
                    <small style={{ color: 'var(--text-secondary)' }}>
                      Diferencia: {deltaAjuste(movBase, Number(movModal.form.conteo)) >= 0 ? '+' : ''}
                      {formatCantidad(deltaAjuste(movBase, Number(movModal.form.conteo)))} {movAlimento.unidad}
                    </small>
                  )}
                </div>
              ) : (
                <div className="input-group">
                  <label>Cantidad ({movAlimento.unidad}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={movModal.form.cantidad}
                    onChange={(e) => updateMovForm('cantidad', e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}
              {movModal.form.tipo === 'ingreso' && (
                <div className="input-group">
                  <label>Precio total pagado ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={movModal.form.precioTotal}
                    onChange={(e) => updateMovForm('precioTotal', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              )}
              <div className="input-group">
                <label>Nota</label>
                <input
                  type="text"
                  value={movModal.form.nota}
                  onChange={(e) => updateMovForm('nota', e.target.value)}
                  placeholder={movModal.form.tipo === 'ingreso' ? 'Ej: proveedor, factura' : 'Opcional'}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setMovModal(null)} className="btn" style={{ flex: 1, background: 'var(--border)' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
