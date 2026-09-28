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
  deleteDoc,
  deleteField,
  writeBatch,
} from '../lib/db';
import { db } from '../firebase/config';
import { Plus, Edit2, Trash2, X, Clock, RotateCcw, Ban, MinusCircle } from 'lucide-react';
import { useCampo } from '../firebase/CampoContext';
import { useNuevoParam } from '../lib/useNuevoParam';
import './Ovejas.css';

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

// Inversa de dateFromInput: Timestamp/Date → 'YYYY-MM-DD' para un <input type="date">.
function inputFromDate(fecha) {
  if (!fecha) return new Date().toISOString().split('T')[0];
  const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return date.toISOString().split('T')[0];
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

// Motivos por los que una oveja sale del stock. La oveja no se borra: queda con
// `baja: { motivo, fecha, nota }` y su historial completo.
const MOTIVOS_BAJA = [
  { value: 'faena', label: 'Faena' },
  { value: 'muerte', label: 'Muerte' },
  { value: 'cesion', label: 'Cesión' },
  { value: 'robo', label: 'Robo' },
  { value: 'venta', label: 'Venta' },
];

function motivoBajaLabel(motivo) {
  return MOTIVOS_BAJA.find((m) => m.value === motivo)?.label || motivo;
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
  const [selectedOvejaId, setSelectedOvejaId] = useState('');

  // Filtrar ovejas
  const visibles = filtro
    ? ovejas.filter((ov) =>
      String(ov.numeroCaravana).toLowerCase().includes(filtro.toLowerCase())
    )
    : ovejas;

  // Filtrar solo ovejas con historial genealógico
  const ovejasConHistorial = visibles.filter(ov => ov.madre || ov.padre);

  // Auto-seleccionar la primera oveja con historial
  useEffect(() => {
    if (!selectedOvejaId && ovejasConHistorial.length > 0) {
      setSelectedOvejaId(ovejasConHistorial[0].id);
    }
  }, [ovejasConHistorial.length]);

  // Seleccionar oveja para mostrar árbol
  const ovejaSeleccionada = selectedOvejaId
    ? ovejas.find(ov => ov.id === selectedOvejaId)
    : ovejasConHistorial[0];

  if (!ovejas.length) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-secondary)' }}>
          Aún no hay ovejas registradas. Agrega una desde la pestaña Listado.
        </p>
      </div>
    );
  }

  // Función para renderizar un nodo del árbol
  const renderNode = (oveja, relacion) => {
    if (!oveja) {
      return (
        <div className="tree-node-empty">
          <span>Sin registro</span>
        </div>
      );
    }

    const isFemale = oveja.sexo === 'hembra';
    const nodeColor = isFemale ? '#e91e63' : '#2196f3';

    return (
      <div className="tree-node-card">
        {relacion && (
          <div className="tree-node-relation" style={{ backgroundColor: nodeColor }}>
            {relacion}
          </div>
        )}
        <div className="tree-node-circle" style={{ backgroundColor: nodeColor }}>
          <span>#{oveja.numeroCaravana}</span>
        </div>
        <div className="tree-node-info">
          <div className="tree-node-raza">{oveja.raza || 'Sin raza'}</div>
        </div>
      </div>
    );
  };

  // Obtener familiares
  const madre = ovejaSeleccionada ? findOvejaPorCaravana(ovejas, ovejaSeleccionada.madre) : null;
  const padre = ovejaSeleccionada ? findOvejaPorCaravana(ovejas, ovejaSeleccionada.padre) : null;
  const abuelaMaterna = madre ? findOvejaPorCaravana(ovejas, madre.madre) : null;
  const abueloMaterno = madre ? findOvejaPorCaravana(ovejas, madre.padre) : null;
  const abuelaPaterna = padre ? findOvejaPorCaravana(ovejas, padre.madre) : null;
  const abueloPaterno = padre ? findOvejaPorCaravana(ovejas, padre.padre) : null;

  return (
    <div className="card genealogia-card">
      <div className="gene-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>Árbol genealógico</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
            Selecciona una oveja para ver su árbol genealógico
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar caravana..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{
              minWidth: '150px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          />
          <select
            value={selectedOvejaId}
            onChange={(e) => setSelectedOvejaId(e.target.value)}
            style={{
              minWidth: '150px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <option value="">Seleccionar oveja...</option>
            {ovejasConHistorial.length === 0 ? (
              <option disabled>No hay ovejas con historial genealógico</option>
            ) : (
              ovejasConHistorial.map(ov => (
                <option key={ov.id} value={ov.id}>
                  #{ov.numeroCaravana} - {ov.raza || 'Sin raza'}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {ovejaSeleccionada ? (
        <div className="custom-tree-container">
          {/* Oveja seleccionada */}
          <div className="tree-level tree-level-main">
            {renderNode(ovejaSeleccionada, '')}
          </div>

          {/* Padres */}
          {(madre || padre) && (
            <div className="tree-level tree-level-parents">
              {renderNode(madre, 'Madre')}
              {renderNode(padre, 'Padre')}
            </div>
          )}

          {/* Abuelos */}
          {(abuelaMaterna || abueloMaterno || abuelaPaterna || abueloPaterno) && (
            <div className="tree-level tree-level-grandparents">
              {renderNode(abuelaMaterna, 'Abuela Materna')}
              {renderNode(abueloMaterno, 'Abuelo Materno')}
              {renderNode(abuelaPaterna, 'Abuela Paterna')}
              {renderNode(abueloPaterno, 'Abuelo Paterno')}
            </div>
          )}

          {/* Leyenda */}
          <div className="tree-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#e91e63' }}></div>
              <span>Hembra</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#2196f3' }}></div>
              <span>Macho</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Selecciona una oveja con historial genealógico para ver su árbol familiar
        </div>
      )}
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
  const [papelera, setPapelera] = useState([]);
  const [loadingPapelera, setLoadingPapelera] = useState(false);
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
  const [editingEventoId, setEditingEventoId] = useState(null);
  const [bajaOveja, setBajaOveja] = useState(null);
  const [bajaForm, setBajaForm] = useState({ motivo: 'venta', fecha: '', nota: '' });
  const [savingBaja, setSavingBaja] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showPesoModal, setShowPesoModal] = useState(false);

  const { selectedCampoId, loadingCampos } = useCampo();

  // Accesos directos del header: ?nuevo=evento | ?nuevo=oveja
  useNuevoParam((nuevo) => {
    if (nuevo === 'evento') openHistorialModal();
    if (nuevo === 'oveja') openNuevaOveja();
  }, !loading);

  const ovejaActionRowStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    width: '100%',
  };

  const historialButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f4f7f3',
    color: 'var(--primary)',
    flex: '1 1 200px',
  };

  const primaryActionButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1 1 200px',
  };

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
    loadPapelera(selectedCampoId);
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

  async function loadPapelera(campoId) {
    try {
      setLoadingPapelera(true);
      const q = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', false)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

      // Filtrar últimos 10 días client-side
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 10);

      const recentDeleted = data.filter((ov) => {
        if (!ov.deletedAt) return false;
        const deletedDate = ov.deletedAt.toDate ? ov.deletedAt.toDate() : new Date(ov.deletedAt);
        return deletedDate >= limitDate;
      });

      recentDeleted.sort((a, b) => {
        const dateA = a.deletedAt?.toDate ? a.deletedAt.toDate() : new Date(a.deletedAt);
        const dateB = b.deletedAt?.toDate ? b.deletedAt.toDate() : new Date(b.deletedAt);
        return dateB - dateA; // Descending
      });

      setPapelera(recentDeleted);
    } catch (error) {
      console.error('Error cargando papelera:', error);
    } finally {
      setLoadingPapelera(false);
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
    setEditingEventoId(null);
    setShowHistorialModal(true);
  }

  function openNuevaOveja() {
    resetForm();
    setEditingOveja(null);
    setShowModal(true);
  }

  function openEditarEvento(evento) {
    setHistorialForm({
      numeroCaravana: evento.numeroCaravana || '',
      fecha: inputFromDate(evento.fecha),
      titulo: evento.titulo || '',
      detalle: evento.detalle || '',
    });
    setEditingEventoId(evento.id);
    setShowHistorialModal(true);
  }

  async function handleEliminarEvento(evento) {
    if (!window.confirm(`¿Borrar el evento "${evento.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'ovejaHistorial', evento.id));
      loadHistorial(selectedCampoId);
    } catch (error) {
      console.error('Error borrando evento:', error);
      alert(error.message || 'No se pudo borrar el evento');
    }
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
      const evento = {
        ovejaId: ovejaSeleccionada.id,
        numeroCaravana: ovejaSeleccionada.numeroCaravana,
        titulo: historialForm.titulo.trim(),
        detalle: historialForm.detalle.trim(),
        fecha: dateFromInput(historialForm.fecha),
      };
      if (editingEventoId) {
        await updateDoc(doc(db, 'ovejaHistorial', editingEventoId), { ...evento, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, 'ovejaHistorial'), { ...evento, campoId: selectedCampoId, createdAt: new Date() });
      }
      resetHistorialForm();
      setEditingEventoId(null);
      setShowHistorialModal(false);
      loadHistorial(selectedCampoId);
    } catch (error) {
      console.error('Error guardando historial:', error);
      alert(error.message || 'No se pudo guardar el evento');
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

  async function handleRestore(oveja) {
    if (!window.confirm(`¿Restaurar la oveja #${oveja.numeroCaravana}?`)) return;
    try {
      await updateDoc(doc(db, 'ovejas', oveja.id), {
        activa: true,
        deletedAt: null,
        updatedAt: new Date(),
      });
      loadOvejas(selectedCampoId);
      loadPapelera(selectedCampoId);
    } catch (error) {
      console.error('Error restaurando oveja:', error);
      alert('No se pudo restaurar la oveja');
    }
  }

  async function handlePermanentDelete(oveja) {
    if (
      !window.confirm(
        `¿Eliminar PERMANENTEMENTE la oveja #${oveja.numeroCaravana}? No se podrá recuperar.`
      )
    )
      return;
    try {
      await deleteDoc(doc(db, 'ovejas', oveja.id));
      loadPapelera(selectedCampoId);
    } catch (error) {
      console.error('Error eliminando permanentemente:', error);
      alert('No se pudo eliminar la oveja permanentemente');
    }
  }

  async function handleDelete(oveja, e) {
    e?.stopPropagation();
    if (!window.confirm(`¿Eliminar la oveja #${oveja.numeroCaravana}?`)) return;
    try {
      await updateDoc(doc(db, 'ovejas', oveja.id), {
        activa: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });
      if (selectedOvejaId === oveja.id) {
        setSelectedOvejaId(null);
        setShowDetalleModal(false);
      }
      loadOvejas(selectedCampoId);
      loadPapelera(selectedCampoId);
    } catch (error) {
      console.error('Error eliminando oveja:', error);
      alert('No se pudo eliminar la oveja');
    }
  }

  function openBajaModal(oveja, e) {
    e?.stopPropagation();
    setBajaForm({ motivo: 'venta', fecha: new Date().toISOString().split('T')[0], nota: '' });
    setBajaOveja(oveja);
  }

  // Marca la baja y deja constancia en el historial, en una sola operación.
  async function handleBajaSubmit(e) {
    e.preventDefault();
    if (!bajaOveja || !selectedCampoId) return;
    setSavingBaja(true);
    try {
      const fecha = dateFromInput(bajaForm.fecha);
      const nota = bajaForm.nota.trim();
      const batch = writeBatch(db);
      batch.update(doc(db, 'ovejas', bajaOveja.id), {
        baja: { motivo: bajaForm.motivo, fecha, nota },
        updatedAt: new Date(),
      });
      batch.set(doc(collection(db, 'ovejaHistorial')), {
        campoId: selectedCampoId,
        ovejaId: bajaOveja.id,
        numeroCaravana: bajaOveja.numeroCaravana,
        titulo: `Baja: ${motivoBajaLabel(bajaForm.motivo)}`,
        detalle: nota || 'Sin observaciones',
        fecha,
        createdAt: new Date(),
      });
      await batch.commit();
      setBajaOveja(null);
      loadOvejas(selectedCampoId);
      loadHistorial(selectedCampoId);
    } catch (error) {
      console.error('Error dando de baja:', error);
      alert(error.message || 'No se pudo dar de baja la oveja');
    } finally {
      setSavingBaja(false);
    }
  }

  async function handleRevertirBaja(oveja) {
    const motivo = motivoBajaLabel(oveja.baja?.motivo);
    if (!window.confirm(`¿Revertir la baja (${motivo}) de la oveja #${oveja.numeroCaravana}? Vuelve a contar en el stock.`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'ovejas', oveja.id), { baja: deleteField(), updatedAt: new Date() });
      batch.set(doc(collection(db, 'ovejaHistorial')), {
        campoId: selectedCampoId,
        ovejaId: oveja.id,
        numeroCaravana: oveja.numeroCaravana,
        titulo: 'Baja revertida',
        detalle: `Se revirtió la baja por ${motivo}. La oveja vuelve al stock.`,
        fecha: new Date(),
        createdAt: new Date(),
      });
      await batch.commit();
      loadOvejas(selectedCampoId);
      loadHistorial(selectedCampoId);
    } catch (error) {
      console.error('Error revirtiendo baja:', error);
      alert(error.message || 'No se pudo revertir la baja');
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
  // El stock son las ovejas sin baja; las dadas de baja siguen en genealogía e historial.
  const ovejasEnStock = ovejasOrdenadas.filter((ov) => !ov.baja);
  const ovejasDeBaja = ovejasOrdenadas.filter((ov) => ov.baja);

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
      if (event.key !== 'Escape') return;
      // Cierra solo el modal de arriba (los de acción se abren sobre la ficha).
      if (bajaOveja) setBajaOveja(null);
      else if (showHistorialModal) setShowHistorialModal(false);
      else if (showPesoModal) setShowPesoModal(false);
      else if (showModal) setShowModal(false);
      else if (showDetalleModal) setShowDetalleModal(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bajaOveja, showDetalleModal, showHistorialModal, showModal, showPesoModal]);

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
          <div className="ovejas-header-actions" style={ovejaActionRowStyle}>
            <button
              className="btn"
              style={historialButtonStyle}
              onClick={openHistorialModal}
            >
              <Clock size={18} />
              Registrar evento
            </button>
            <button
              onClick={openNuevaOveja}
              className="btn btn-primary"
              style={primaryActionButtonStyle}
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
        <button
          className={`tab-btn ${vista === 'bajas' ? 'active' : ''}`}
          onClick={() => setVista('bajas')}
        >
          Bajas ({ovejasDeBaja.length})
        </button>
        <button
          className={`tab-btn ${vista === 'papelera' ? 'active' : ''}`}
          onClick={() => setVista('papelera')}
        >
          Papelera ({papelera.length})
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
      ) : vista === 'bajas' ? (
        ovejasDeBaja.length === 0 ? (
          <div className="card">
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
              No hay ovejas dadas de baja. Usá &quot;Dar de baja&quot; en la ficha de una oveja cuando se faena, muere, se cede, se roba o se vende.
            </p>
          </div>
        ) : (
          <div className="card table-scroll">
            <table className="table ovejas-table">
              <thead>
                <tr>
                  <th>Caravana</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th className="col-hide-mobile">Nota</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ovejasDeBaja.map((ov) => (
                  <tr
                    key={ov.id}
                    onClick={() => {
                      setSelectedOvejaId(ov.id);
                      setShowDetalleModal(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><strong>{ov.numeroCaravana}</strong></td>
                    <td><span className="badge badge-baja">{motivoBajaLabel(ov.baja.motivo)}</span></td>
                    <td>{formatFechaLarga(ov.baja.fecha)}</td>
                    <td className="col-hide-mobile">{ov.baja.nota || '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        <button
                          className="icon-btn"
                          title="Revertir baja"
                          aria-label="Revertir baja"
                          onClick={() => handleRevertirBaja(ov)}
                          style={{ color: 'var(--primary)' }}
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : vista === 'papelera' ? (
        <>
          {papelera.length === 0 ? (
            <div className="card">
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                La papelera está vacía.
              </p>
            </div>
          ) : (
            <div className="card table-scroll">
              <div
                style={{
                  padding: '16px',
                  background: '#fff3cd',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  color: '#856404',
                  fontSize: '14px',
                }}
              >
                Las ovejas eliminadas permanecerán en la papelera por 10 días antes de ser ocultadas permanentemente.
              </div>
              <table className="table ovejas-table">
                <thead>
                  <tr>
                    <th>Caravana</th>
                    <th>Raza</th>
                    <th>Eliminado el</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {papelera.map((ov) => (
                    <tr key={ov.id}>
                      <td>
                        <strong>{ov.numeroCaravana}</strong>
                      </td>
                      <td>{ov.raza || 'N/A'}</td>
                      <td>{formatFechaLarga(ov.deletedAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            title="Restaurar"
                            onClick={() => handleRestore(ov)}
                            style={{ color: 'var(--primary)' }}
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Eliminar permanentemente"
                            onClick={() => handlePermanentDelete(ov)}
                          >
                            <Ban size={18} />
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
      ) : (
        <>
          {ovejasEnStock.length === 0 ? (
            <div className="card">
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No hay ovejas en stock. ¡Agrega tu primera oveja!
              </p>
            </div>
          ) : (
            <div className="card table-scroll">
              <table className="table ovejas-table">
                <thead>
                  <tr>
                    <th>Caravana</th>
                    <th className="col-hide-mobile">Raza</th>
                    <th>Sexo</th>
                    <th className="col-hide-mobile">Edad</th>
                    <th>Peso (kg)</th>
                    <th className="col-hide-mobile">Estado</th>
                    <th className="col-hide-mobile">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ovejasEnStock.map((oveja) => (
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
                      <td className="col-hide-mobile">{oveja.raza || 'N/A'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{oveja.sexo}</td>
                      <td className="col-hide-mobile">{calcularEdad(oveja.fechaNacimiento)}</td>
                      <td>
                        {oveja.peso?.[oveja.peso.length - 1]?.valor
                          ? `${oveja.peso[oveja.peso.length - 1].valor} kg`
                          : 'N/A'}
                      </td>
                      <td className="col-hide-mobile">
                        {oveja.reproductivo?.gestante ? (
                          <span className="badge badge-gestante">Gestante</span>
                        ) : (
                          <span className="badge badge-normal">Normal</span>
                        )}
                      </td>
                      <td className="col-hide-mobile" onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            title="Editar"
                            onClick={(e) => handleEdit(oveja, e)}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Dar de baja (faena, muerte, venta...)"
                            aria-label="Dar de baja"
                            onClick={(e) => openBajaModal(oveja, e)}
                          >
                            <MinusCircle size={18} />
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            title="Eliminar (error de carga)"
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!selectedOveja.baja && (
                  <button
                    className="btn btn-small btn-baja"
                    onClick={(e) => openBajaModal(selectedOveja, e)}
                  >
                    <MinusCircle size={16} /> Dar de baja
                  </button>
                )}
                <button
                  className="icon-btn"
                  title="Editar"
                  onClick={(e) => handleEdit(selectedOveja, e)}
                >
                  <Edit2 size={18} />
                </button>
                <button
                  className="icon-btn icon-btn-danger"
                  title="Eliminar"
                  onClick={(e) => handleDelete(selectedOveja, e)}
                >
                  <Trash2 size={18} />
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

            {selectedOveja.baja && (
              <div className="baja-banner">
                <div>
                  <strong>Dada de baja: {motivoBajaLabel(selectedOveja.baja.motivo)}</strong>
                  {' · '}{formatFechaLarga(selectedOveja.baja.fecha)}
                  {selectedOveja.baja.nota && <div className="baja-banner-nota">{selectedOveja.baja.nota}</div>}
                  <div className="baja-banner-nota">No cuenta en el stock.</div>
                </div>
                <button className="btn btn-small" onClick={() => handleRevertirBaja(selectedOveja)}>
                  <RotateCcw size={14} /> Revertir
                </button>
              </div>
            )}

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
                          <div className="timeline-header">
                            <p className="timeline-date">{formatFechaLarga(item.fecha)}</p>
                            <div className="timeline-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                title="Editar evento"
                                aria-label="Editar evento"
                                onClick={() => openEditarEvento(item)}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn-danger"
                                title="Borrar evento"
                                aria-label="Borrar evento"
                                onClick={() => handleEliminarEvento(item)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
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

      {bajaOveja && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, () => setBajaOveja(null))}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Dar de baja #{bajaOveja.numeroCaravana}</h2>
              <button onClick={() => setBajaOveja(null)} className="close-btn">
                <X size={24} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
              La oveja deja de contar en el stock pero conserva su historial. Se puede revertir desde la solapa Bajas.
            </p>
            <form onSubmit={handleBajaSubmit}>
              <div className="input-group">
                <label>Motivo *</label>
                <select
                  value={bajaForm.motivo}
                  onChange={(e) => setBajaForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  required
                >
                  {MOTIVOS_BAJA.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={bajaForm.fecha}
                  onChange={(e) => setBajaForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label>Nota</label>
                <textarea
                  rows={3}
                  value={bajaForm.nota}
                  onChange={(e) => setBajaForm((prev) => ({ ...prev, nota: e.target.value }))}
                  placeholder="Ej: vendida a Juan Pérez, $120.000"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingBaja}>
                  {savingBaja ? 'Guardando...' : 'Dar de baja'}
                </button>
                <button
                  type="button"
                  onClick={() => setBajaOveja(null)}
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

      {showHistorialModal && (
        <div
          className="modal-overlay"
          onClick={(e) => handleOverlayClick(e, setShowHistorialModal)}
        >
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingEventoId ? 'Editar evento' : 'Registrar evento'}</h2>
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
                  {editingEventoId ? 'Guardar cambios' : 'Guardar evento'}
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
