import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Plus, Edit2, Trash2, X, Clock } from 'lucide-react';
import { useCampo } from '../firebase/CampoContext';

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

function formatFechaLarga(fecha) {
  if (!fecha) return 'Sin fecha';
  const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function findOvejaPorCaravana(lista, caravana) {
  if (!caravana) return null;
  return lista.find((ov) => String(ov.numeroCaravana) === String(caravana)) || null;
}

function renderGeneNode(oveja, etiqueta, principal = false) {
  return (
    <div className={`gene-node ${principal ? 'gene-node-main' : ''}`}>
      <p className="gene-label">{etiqueta}</p>
      {oveja ? (
        <>
          <strong>#{oveja.numeroCaravana}</strong>
          <span>{oveja.raza || 'Sin raza'}</span>
        </>
      ) : (
        <span className="gene-empty">Sin registro</span>
      )}
    </div>
  );
}

function GenealogiaView({ ovejas }) {
  const [filtro, setFiltro] = useState('');
  const visibles = filtro
    ? ovejas.filter((ov) =>
        String(ov.numeroCaravana).toLowerCase().includes(filtro.toLowerCase())
      )
    : ovejas;
  const bloques = visibles.length ? visibles : ovejas;

  if (!ovejas.length) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-secondary)' }}>
          Aún no hay ovejas registradas. Agrega una desde la pestaña Listado.
        </p>
      </div>
    );
  }

  return (
    <div className="card genealogia-card">
      <div className="gene-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>Árbol genealógico</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
            Filtra por caravana y recorre horizontalmente para ver todas las ramas.
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar caravana..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            minWidth: '200px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      <div className="gene-canvas">
        <div className="gene-tree">
          {bloques.map((ov) => {
            const madre = findOvejaPorCaravana(ovejas, ov.madre);
            const padre = findOvejaPorCaravana(ovejas, ov.padre);
            const abuelaMaterna = madre ? findOvejaPorCaravana(ovejas, madre.madre) : null;
            const abueloMaterno = madre ? findOvejaPorCaravana(ovejas, madre.padre) : null;
            const abuelaPaterna = padre ? findOvejaPorCaravana(ovejas, padre.madre) : null;
            const abueloPaterno = padre ? findOvejaPorCaravana(ovejas, padre.padre) : null;

            return (
              <div key={`gene-${ov.id}`} className="gene-block">
                <div className="gene-level">
                  {renderGeneNode(abuelaMaterna, 'Abuela materna')}
                  {renderGeneNode(abueloMaterno, 'Abuelo materno')}
                  {renderGeneNode(abuelaPaterna, 'Abuela paterna')}
                  {renderGeneNode(abueloPaterno, 'Abuelo paterno')}
                </div>
                <div className="gene-level gene-parents">
                  {renderGeneNode(madre, 'Madre')}
                  <div className="gene-line" />
                  {renderGeneNode(padre, 'Padre')}
                </div>
                <div className="gene-child-wrapper">
                  {renderGeneNode(ov, 'Oveja', true)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Ovejas() {
  const [ovejas, setOvejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOveja, setEditingOveja] = useState(null);
  const [formData, setFormData] = useState({
    numeroCaravana: '',
    fechaNacimiento: '',
    peso: '',
    sexo: 'hembra',
    raza: '',
    madre: '',
    padre: '',
  });
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [historialForm, setHistorialForm] = useState({
    numeroCaravana: '',
    fecha: new Date().toISOString().split('T')[0],
    titulo: '',
    detalle: '',
  });
  const [pesoForm, setPesoForm] = useState({
    numeroCaravana: '',
    fecha: new Date().toISOString().split('T')[0],
    valor: '',
  });
  const [vista, setVista] = useState('listado');
  const [selectedOvejaId, setSelectedOvejaId] = useState(null);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showPesoModal, setShowPesoModal] = useState(false);

  const { selectedCampoId, loadingCampos } = useCampo();

  useEffect(() => {
    if (!selectedCampoId) {
      setOvejas([]);
      setHistorial([]);
      setLoading(false);
      setHistorialLoading(false);
      return;
    }

    loadOvejas(selectedCampoId);
    loadHistorial(selectedCampoId);
  }, [selectedCampoId]);

  async function loadOvejas(campoId) {
    try {
      const q = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      data.sort((a, b) => String(a.numeroCaravana).localeCompare(String(b.numeroCaravana)));
      setOvejas(data);

      setSelectedOvejaId((prev) => {
        if (prev && data.some((ov) => ov.id === prev)) return prev;
        return data[0]?.id || null;
      });
    } catch (error) {
      console.error('Error cargando ovejas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistorial(campoId) {
    try {
      setHistorialLoading(true);
      const q = query(
        collection(db, 'ovejaHistorial'),
        where('campoId', '==', campoId),
        orderBy('fecha', 'desc')
      );
      const snapshot = await getDocs(q);
      setHistorial(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setHistorialLoading(false);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleHistorialInput(e) {
    const { name, value } = e.target;
    setHistorialForm((prev) => ({ ...prev, [name]: value }));
  }

  function handlePesoInput(e) {
    const { name, value } = e.target;
    setPesoForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setFormData({
      numeroCaravana: '',
      fechaNacimiento: '',
      peso: '',
      sexo: 'hembra',
      raza: '',
      madre: '',
      padre: '',
    });
  }

  function resetHistorialForm(numero = '') {
    setHistorialForm({
      numeroCaravana: numero,
      fecha: new Date().toISOString().split('T')[0],
      titulo: '',
      detalle: '',
    });
  }

  function resetPesoForm(numero = '') {
    setPesoForm({
      numeroCaravana: numero,
      fecha: new Date().toISOString().split('T')[0],
      valor: '',
    });
  }

  function openHistorialModal() {
    if (!ovejas.length) {
      alert('Primero debes registrar una oveja.');
      return;
    }
    const numeroDefault =
      selectedOveja?.numeroCaravana || ovejas[0]?.numeroCaravana || '';
    resetHistorialForm(numeroDefault);
    setShowHistorialModal(true);
  }

  function openPesoModal() {
    if (!ovejas.length) {
      alert('Primero debes registrar una oveja.');
      return;
    }
    const numeroDefault =
      selectedOveja?.numeroCaravana || ovejas[0]?.numeroCaravana || '';
    resetPesoForm(numeroDefault);
    setShowPesoModal(true);
  }

  async function handleHistorialSubmit(e) {
    e.preventDefault();
    if (!selectedCampoId) return;

    const ovejaSeleccionada = findOvejaPorCaravana(
      ovejas,
      historialForm.numeroCaravana.trim()
    );
    if (!ovejaSeleccionada) {
      alert('No encontramos una oveja con ese número de caravana.');
      return;
    }

    try {
      const fechaEvento = dateFromInput(historialForm.fecha);
      await addDoc(collection(db, 'ovejaHistorial'), {
        campoId: selectedCampoId,
        ovejaId: ovejaSeleccionada.id,
        numeroCaravana: ovejaSeleccionada.numeroCaravana,
        titulo: historialForm.titulo.trim(),
        detalle: historialForm.detalle.trim(),
        fecha: fechaEvento,
        createdAt: new Date(),
      });
      resetHistorialForm();
      setShowHistorialModal(false);
      loadHistorial(selectedCampoId);
    } catch (error) {
      console.error('Error guardando historial:', error);
      alert('No se pudo guardar el historial');
    }
  }

  async function handlePesoSubmit(e) {
    e.preventDefault();
    if (!selectedCampoId) return;

    const ovejaSeleccionada = findOvejaPorCaravana(ovejas, pesoForm.numeroCaravana.trim());
    if (!ovejaSeleccionada) {
      alert('No encontramos una oveja con ese número de caravana.');
      return;
    }

    const pesoValor = parseFloat(pesoForm.valor);
    if (!Number.isFinite(pesoValor) || pesoValor <= 0) {
      alert('Ingresa un peso válido.');
      return;
    }

    const nuevaEntrada = {
      fecha: dateFromInput(pesoForm.fecha),
      valor: pesoValor,
    };

    const historialPeso = Array.isArray(ovejaSeleccionada.peso)
      ? [...ovejaSeleccionada.peso]
      : [];
    historialPeso.push(nuevaEntrada);
    historialPeso.sort((a, b) => {
      const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return fechaA - fechaB;
    });

    try {
      await updateDoc(doc(db, 'ovejas', ovejaSeleccionada.id), {
        peso: historialPeso,
        updatedAt: new Date(),
      });
      resetPesoForm();
      setShowPesoModal(false);
      loadOvejas(selectedCampoId);
    } catch (error) {
      console.error('Error registrando peso:', error);
      alert('No se pudo registrar el peso.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCampoId) {
      alert('Selecciona un campo antes de registrar ovejas.');
      return;
    }

    const numeroCaravana = formData.numeroCaravana.trim();
    if (!numeroCaravana) {
      alert('El número de caravana es obligatorio.');
      return;
    }

    const now = new Date();
    const pesoValor = parseFloat(formData.peso);
    let payload = {
      numeroCaravana,
      fechaNacimiento: dateFromInput(formData.fechaNacimiento),
      sexo: formData.sexo,
      raza: formData.raza.trim(),
      madre: formData.madre.trim(),
      padre: formData.padre.trim(),
      campoId: selectedCampoId,
      activa: true,
      updatedAt: now,
    };

    if (editingOveja) {
      payload = {
        ...editingOveja,
        ...payload,
      };
      const pesoHistorial = Array.isArray(editingOveja.peso) ? [...editingOveja.peso] : [];
      if (Number.isFinite(pesoValor)) {
        if (!pesoHistorial.length || pesoHistorial[pesoHistorial.length - 1].valor !== pesoValor) {
          pesoHistorial.push({ fecha: now, valor: pesoValor });
        }
      }
      payload.peso = pesoHistorial;
    } else {
      payload = {
        ...payload,
        peso: Number.isFinite(pesoValor) ? [{ fecha: now, valor: pesoValor }] : [],
        produccionLeche: [],
        enfermedades: [],
        reproductivo: {
          gestante: false,
          ultimoParto: null,
          ultimaInseminacion: null,
          fechaProximoParto: null,
        },
        createdAt: now,
      };
    }

    try {
      if (editingOveja) {
        await updateDoc(doc(db, 'ovejas', editingOveja.id), payload);
      } else {
        await addDoc(collection(db, 'ovejas'), payload);
      }
      setShowModal(false);
      setEditingOveja(null);
      resetForm();
      loadOvejas(selectedCampoId);
    } catch (error) {
      console.error('Error guardando oveja:', error);
      alert('No se pudo guardar la oveja.');
    }
  }

  function handleEdit(oveja, e) {
    e?.stopPropagation();
    setEditingOveja(oveja);
    setFormData({
      numeroCaravana: oveja.numeroCaravana || '',
      fechaNacimiento: oveja.fechaNacimiento
        ? (oveja.fechaNacimiento.toDate
            ? oveja.fechaNacimiento.toDate().toISOString().split('T')[0]
            : new Date(oveja.fechaNacimiento).toISOString().split('T')[0])
        : '',
      peso: oveja.peso?.[oveja.peso.length - 1]?.valor?.toString() || '',
      sexo: oveja.sexo || 'hembra',
      raza: oveja.raza || '',
      madre: oveja.madre || '',
      padre: oveja.padre || '',
    });
    setShowModal(true);
  }

  async function handleDelete(oveja, e) {
    e?.stopPropagation();
    if (!window.confirm(`¿Eliminar la oveja #${oveja.numeroCaravana}?`)) return;
    try {
      await updateDoc(doc(db, 'ovejas', oveja.id), { activa: false, updatedAt: new Date() });
      if (selectedOvejaId === oveja.id) {
        setSelectedOvejaId(null);
        setShowDetalleModal(false);
      }
      loadOvejas(selectedCampoId);
    } catch (error) {
      console.error('Error eliminando oveja:', error);
      alert('No se pudo eliminar la oveja');
    }
  }

  function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'N/A';
    const fecha = fechaNacimiento.toDate ? fechaNacimiento.toDate() : new Date(fechaNacimiento);
    const hoy = new Date();
    const meses =
      (hoy.getFullYear() - fecha.getFullYear()) * 12 + (hoy.getMonth() - fecha.getMonth());
    if (meses < 12) return `${meses} meses`;
    const años = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    return `${años} año${años !== 1 ? 's' : ''}${mesesRestantes ? ` y ${mesesRestantes}m` : ''}`;
  }

  const selectedOveja = ovejas.find((ov) => ov.id === selectedOvejaId) || null;
  const historialFiltrado = selectedOveja
    ? historial.filter((item) => item.ovejaId === selectedOveja.id)
    : historial;
  const pesoHistorial = selectedOveja?.peso
    ? [...selectedOveja.peso].sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
        return fechaB - fechaA;
      })
    : [];
  const ovejasOrdenadas = ovejas;

  useEffect(() => {
    if (selectedOveja) {
      setHistorialForm((prev) => ({
        ...prev,
        numeroCaravana: selectedOveja.numeroCaravana || prev.numeroCaravana,
      }));
      setPesoForm((prev) => ({
        ...prev,
        numeroCaravana: selectedOveja.numeroCaravana || prev.numeroCaravana,
      }));
    }
  }, [selectedOvejaId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (showDetalleModal) setShowDetalleModal(false);
        if (showHistorialModal) setShowHistorialModal(false);
        if (showModal) setShowModal(false);
        if (showPesoModal) setShowPesoModal(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetalleModal, showHistorialModal, showModal, showPesoModal]);

  function handleOverlayClick(e, setter) {
    if (e.target === e.currentTarget) setter(false);
  }

  if (loadingCampos || loading) {
    return (
      <div className="container">
        <div className="loading">Cargando ovejas...</div>
      </div>
    );
  }

  if (!selectedCampoId) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ marginBottom: '10px' }}>Selecciona un campo</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Usa el selector en la barra superior o crea un campo en Configuración para gestionar tus ovejas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="ovejas-header">
        <div>
          <h1 style={{ margin: 0 }}>Gestión de Ovejas</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
            Cambia de pestaña para ver el listado o el árbol genealógico.
          </p>
        </div>
        {vista === 'listado' && (
          <div className="ovejas-header-actions">
            <button
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f2f8f0',
                color: 'var(--primary)',
              }}
              onClick={openHistorialModal}
            >
              <Clock size={18} />
              Registrar historial
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingOveja(null);
                setShowModal(true);
              }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={20} />
              Agregar Oveja
            </button>
          </div>
        )}
      </div>

      <div className="ovejas-tabs">
        <button
          className={`tab-btn ${vista === 'listado' ? 'active' : ''}`}
          onClick={() => setVista('listado')}
        >
          Listado
        </button>
        <button
          className={`tab-btn ${vista === 'genealogia' ? 'active' : ''}`}
          onClick={() => setVista('genealogia')}
        >
          Árbol genealógico
        </button>
      </div>

      <datalist id="caravanas-options">
        {ovejasOrdenadas.map((ov) => (
          <option key={ov.id} value={ov.numeroCaravana}>
            {ov.numeroCaravana} · {ov.raza || 'Sin raza'}
          </option>
        ))}
      </datalist>

      {vista === 'genealogia' ? (
        <GenealogiaView ovejas={ovejasOrdenadas} />
      ) : (
        <>
          {ovejas.length === 0 ? (
            <div className="card">
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No hay ovejas registradas. ¡Agrega tu primera oveja!
              </p>
            </div>
          ) : (
            <div className="card table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Caravana</th>
                    <th>Raza</th>
                    <th>Sexo</th>
                    <th>Edad</th>
                    <th>Peso (kg)</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ovejasOrdenadas.map((oveja) => (
                    <tr
                      key={oveja.id}
                      onClick={() => {
                        setSelectedOvejaId(oveja.id);
                        setShowDetalleModal(true);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong>{oveja.numeroCaravana}</strong>
                      </td>
                      <td>{oveja.raza || 'N/A'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{oveja.sexo}</td>
                      <td>{calcularEdad(oveja.fechaNacimiento)}</td>
                      <td>
                        {oveja.peso?.[oveja.peso.length - 1]?.valor
                          ? `${oveja.peso[oveja.peso.length - 1].valor} kg`
                          : 'N/A'}
                      </td>
                      <td>
                        {oveja.reproductivo?.gestante ? (
                          <span className="badge badge-gestante">Gestante</span>
                        ) : (
                          <span className="badge badge-normal">Normal</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            title="Editar"
                            onClick={(e) => handleEdit(oveja, e)}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Eliminar"
                            onClick={(e) => handleDelete(oveja, e)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showDetalleModal && selectedOveja && (
        <div
          className="modal-overlay"
          onClick={(e) => handleOverlayClick(e, setShowDetalleModal)}
        >
          <div className="modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Oveja seleccionada
                </p>
                <h2 style={{ marginTop: '2px' }}>#{selectedOveja.numeroCaravana}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="icon-btn"
                  title="Editar"
                  onClick={(e) => handleEdit(selectedOveja, e)}
                >
                  <Edit2 size={18} />
                </button>
                <button
                  className="icon-btn"
                  title="Cerrar"
                  onClick={() => setShowDetalleModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="detalle-oveja">
              <div className="detalle-grid">
                <div>
                  <p className="detalle-label">Raza</p>
                  <p className="detalle-value">{selectedOveja.raza || 'N/A'}</p>
                </div>
                <div>
                  <p className="detalle-label">Sexo</p>
                  <p className="detalle-value" style={{ textTransform: 'capitalize' }}>
                    {selectedOveja.sexo || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="detalle-label">Edad</p>
                  <p className="detalle-value">{calcularEdad(selectedOveja.fechaNacimiento)}</p>
                </div>
                <div>
                  <p className="detalle-label">Peso actual</p>
                  <p className="detalle-value">
                    {selectedOveja.peso?.[selectedOveja.peso.length - 1]?.valor
                      ? `${selectedOveja.peso[selectedOveja.peso.length - 1].valor} kg`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="detalle-label">Madre</p>
                  <p className="detalle-value">{selectedOveja.madre || 'Sin dato'}</p>
                </div>
                <div>
                  <p className="detalle-label">Padre</p>
                  <p className="detalle-value">{selectedOveja.padre || 'Sin dato'}</p>
                </div>
              </div>

              <div className="timeline-wrapper">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 style={{ margin: 0 }}>Historial</h3>
                  <button className="btn btn-small" onClick={openHistorialModal}>
                    + Registrar evento
                  </button>
                </div>
                {historialLoading ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Cargando historial...</p>
                ) : historialFiltrado.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>
                    No registraste eventos para esta oveja todavía.
                  </p>
                ) : (
                  <div className="timeline">
                    {historialFiltrado.map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <p className="timeline-date">{formatFechaLarga(item.fecha)}</p>
                          <p className="timeline-title">{item.titulo}</p>
                          <p className="timeline-detail">{item.detalle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="timeline-wrapper">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 style={{ margin: 0 }}>Historial de peso</h3>
                  <button className="btn btn-small" onClick={openPesoModal}>
                    + Registrar peso
                  </button>
                </div>
                {pesoHistorial.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Todavía no cargaste mediciones de peso para esta oveja.
                  </p>
                ) : (
                  <div className="timeline">
                    {pesoHistorial.map((item, index) => (
                      <div key={`${item.fecha?.seconds || index}-${item.valor}`} className="timeline-item">
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <p className="timeline-date">{formatFechaLarga(item.fecha)}</p>
                          <p className="timeline-title">{item.valor} kg</p>
                          {index === 0 ? (
                            <p className="timeline-detail">Medición más reciente</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistorialModal && (
        <div
          className="modal-overlay"
          onClick={(e) => handleOverlayClick(e, setShowHistorialModal)}
        >
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar historial</h2>
              <button onClick={() => setShowHistorialModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleHistorialSubmit}>
              <div className="input-group">
                <label>Número de caravana *</label>
                <input
                  type="text"
                  name="numeroCaravana"
                  list="caravanas-options"
                  value={historialForm.numeroCaravana}
                  onChange={handleHistorialInput}
                  required
                />
              </div>

              <div className="input-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  value={historialForm.fecha}
                  onChange={handleHistorialInput}
                  required
                />
              </div>

              <div className="input-group">
                <label>Título *</label>
                <input
                  type="text"
                  name="titulo"
                  value={historialForm.titulo}
                  onChange={handleHistorialInput}
                  placeholder="Ej: Control veterinario"
                  required
                />
              </div>

              <div className="input-group">
                <label>Detalle *</label>
                <textarea
                  name="detalle"
                  rows={4}
                  value={historialForm.detalle}
                  onChange={handleHistorialInput}
                  placeholder="Describe qué sucedió o qué tratamiento recibió"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar historial
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistorialModal(false)}
                  className="btn"
                  style={{ flex: 1, background: 'var(--border)' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowModal)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingOveja ? 'Editar oveja' : 'Agregar nueva oveja'}
              </h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Número de caravana *</label>
                <input
                  type="text"
                  name="numeroCaravana"
                  value={formData.numeroCaravana}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Fecha de nacimiento *</label>
                <input
                  type="date"
                  name="fechaNacimiento"
                  value={formData.fechaNacimiento}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Peso (kg)</label>
                <input
                  type="number"
                  name="peso"
                  value={formData.peso}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  placeholder="Ej: 55.5"
                />
              </div>

              <div className="input-group">
                <label>Sexo *</label>
                <select name="sexo" value={formData.sexo} onChange={handleInputChange} required>
                  <option value="hembra">Hembra</option>
                  <option value="macho">Macho</option>
                </select>
              </div>

              <div className="input-group">
                <label>Raza</label>
                <input
                  type="text"
                  name="raza"
                  value={formData.raza}
                  onChange={handleInputChange}
                  placeholder="Ej: Merino, Corriedale"
                />
              </div>

              <div className="input-group">
                <label>Caravana de la madre (opcional)</label>
                <input
                  type="text"
                  name="madre"
                  list="caravanas-options"
                  value={formData.madre}
                  onChange={handleInputChange}
                  placeholder="Busca o escribe el número"
                />
              </div>

              <div className="input-group">
                <label>Caravana del padre (opcional)</label>
                <input
                  type="text"
                  name="padre"
                  list="caravanas-options"
                  value={formData.padre}
                  onChange={handleInputChange}
                  placeholder="Busca o escribe el número"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingOveja ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingOveja(null);
                  }}
                  className="btn"
                  style={{ flex: 1, background: 'var(--border)' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPesoModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowPesoModal)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar peso</h2>
              <button onClick={() => setShowPesoModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePesoSubmit}>
              <div className="input-group">
                <label>Número de caravana *</label>
                <input
                  type="text"
                  name="numeroCaravana"
                  list="caravanas-options"
                  value={pesoForm.numeroCaravana}
                  onChange={handlePesoInput}
                  required
                />
              </div>
              <div className="input-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  value={pesoForm.fecha}
                  onChange={handlePesoInput}
                  required
                />
              </div>
              <div className="input-group">
                <label>Peso (kg) *</label>
                <input
                  type="number"
                  name="valor"
                  value={pesoForm.valor}
                  onChange={handlePesoInput}
                  min="0"
                  step="0.1"
                  placeholder="Ej: 54.3"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar registro
                </button>
                <button
                  type="button"
                  onClick={() => setShowPesoModal(false)}
                  className="btn"
                  style={{ flex: 1, background: 'var(--border)' }}
                >
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
