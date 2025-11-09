import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Plus, Trash2, X, CheckCircle, Circle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCampo } from '../firebase/CampoContext';

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

export default function Tareas() {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'revision',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    ovejaId: ''
  });
  const { selectedCampoId, loadingCampos } = useCampo();

  const tiposTarea = [
    { value: 'vacunacion', label: 'Vacunación', color: '#d32f2f' },
    { value: 'desparasitacion', label: 'Desparasitación', color: '#7b1fa2' },
    { value: 'revision', label: 'Revisión', color: '#0288d1' },
    { value: 'esquila', label: 'Esquila', color: '#f57c00' },
    { value: 'parto', label: 'Parto esperado', color: '#c2185b' },
    { value: 'inseminacion', label: 'Inseminación', color: '#7b1fa2' },
    { value: 'alimentacion', label: 'Alimentación', color: '#558b2f' },
    { value: 'otra', label: 'Otra', color: '#616161' }
  ];

  useEffect(() => {
    if (!selectedCampoId) {
      setTareas([]);
      setLoading(false);
      return;
    }
    loadTareas(selectedCampoId);
  }, [selectedCampoId]);

  async function loadTareas(campoId) {
    try {
      const q = query(
        collection(db, 'tareas'),
        where('campoId', '==', campoId),
        orderBy('fecha', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const tareasData = [];
      
      querySnapshot.forEach((doc) => {
        tareasData.push({ id: doc.id, ...doc.data() });
      });
      
      setTareas(tareasData);
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCampoId) {
      alert('Selecciona un campo antes de crear tareas.');
      return;
    }
    
    try {
      await addDoc(collection(db, 'tareas'), {
        ...formData,
        fecha: dateFromInput(formData.fecha),
        completada: false,
        campoId: selectedCampoId,
        createdAt: new Date()
      });
      
      setShowModal(false);
      setFormData({
        tipo: 'revision',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        ovejaId: ''
      });
      loadTareas(selectedCampoId);
    } catch (error) {
      console.error('Error guardando tarea:', error);
      alert('Error al guardar la tarea');
    }
  }

  async function toggleCompletada(id, completada) {
    try {
      await updateDoc(doc(db, 'tareas', id), {
        completada: !completada
      });
      loadTareas(selectedCampoId);
    } catch (error) {
      console.error('Error actualizando tarea:', error);
    }
  }

  async function handleDelete(id) {
    if (window.confirm('¿Estás seguro de eliminar esta tarea?')) {
      try {
        await deleteDoc(doc(db, 'tareas', id));
        loadTareas(selectedCampoId);
      } catch (error) {
        console.error('Error eliminando tarea:', error);
      }
    }
  }

  function getTareaColor(tipo) {
    const tarea = tiposTarea.find(t => t.value === tipo);
    return tarea ? tarea.color : '#616161';
  }

  function getTareaLabel(tipo) {
    const tarea = tiposTarea.find(t => t.value === tipo);
    return tarea ? tarea.label : tipo;
  }

  function esPasada(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha.toDate() < hoy;
  }

  function esHoy(fecha) {
    const hoy = new Date();
    const fechaTarea = fecha.toDate();
    return (
      fechaTarea.getDate() === hoy.getDate() &&
      fechaTarea.getMonth() === hoy.getMonth() &&
      fechaTarea.getFullYear() === hoy.getFullYear()
    );
  }

  function separarTareas() {
    const pendientes = [];
    const completadas = [];

    tareas.forEach(tarea => {
      if (tarea.completada) {
        completadas.push(tarea);
      } else {
        pendientes.push(tarea);
      }
    });

    return { pendientes, completadas };
  }

  const { pendientes, completadas } = separarTareas();
  const resumenPendientes = pendientes.slice(0, 5);

  if (loadingCampos || loading) {
    return (
      <div className="container">
        <div className="loading">Cargando tareas...</div>
      </div>
    );
  }

  if (!selectedCampoId) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ marginBottom: '10px' }}>Selecciona un campo</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Usa el selector del encabezado o crea un campo en Configuración para gestionar tus tareas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Tareas y Recordatorios</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={20} />
          Nueva Tarea
        </button>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ marginBottom: '20px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={24} />
            Tareas Pendientes ({pendientes.length})
          </h2>

          {pendientes.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
              ¡No hay tareas pendientes! 🎉
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendientes.map(tarea => (
                <div
                  key={`pendiente-${tarea.id}`}
                  className="tarea-card pending"
                  style={{ borderLeftColor: getTareaColor(tarea.tipo) }}
                >
                  <div className="tarea-header">
                    <button
                      className="tarea-toggle"
                      onClick={() => toggleCompletada(tarea.id, tarea.completada)}
                      aria-label="Marcar completada"
                    >
                      <Circle size={22} color={getTareaColor(tarea.tipo)} />
                    </button>
                    <span className="tarea-chip" style={{ background: getTareaColor(tarea.tipo) }}>
                      {getTareaLabel(tarea.tipo)}
                    </span>
                    {tarea.ovejaId && (
                      <span className="tarea-meta">Oveja #{tarea.ovejaId}</span>
                    )}
                    <div className="tarea-actions">
                      <button
                        className="btn-compact success"
                        onClick={() => toggleCompletada(tarea.id, tarea.completada)}
                      >
                        Marcar
                      </button>
                      <button
                        className="btn-compact danger"
                        onClick={() => handleDelete(tarea.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="tarea-body">
                    <div className="tarea-desc">{tarea.descripcion}</div>
                    <div className="tarea-date">
                      {esHoy(tarea.fecha) && '🔔 '}
                      {esPasada(tarea.fecha) && !tarea.completada && '⚠️ '}
                      {format(tarea.fecha.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '20px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={24} />
            Tareas Completadas ({completadas.length})
          </h2>

          {completadas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
              No hay tareas completadas
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {completadas.map(tarea => (
                <div
                  key={`completada-${tarea.id}`}
                  className="tarea-card done"
                  style={{ borderLeftColor: getTareaColor(tarea.tipo) }}
                >
                  <div className="tarea-header">
                    <button
                      className="tarea-toggle"
                      onClick={() => toggleCompletada(tarea.id, tarea.completada)}
                      aria-label="Marcar pendiente"
                    >
                      <CheckCircle size={22} color={getTareaColor(tarea.tipo)} />
                    </button>
                    <span className="tarea-chip" style={{ background: getTareaColor(tarea.tipo) }}>
                      {getTareaLabel(tarea.tipo)}
                    </span>
                    <div className="tarea-actions">
                      <button
                        className="btn-compact"
                        onClick={() => toggleCompletada(tarea.id, tarea.completada)}
                      >
                        Reabrir
                      </button>
                      <button
                        className="btn-compact danger"
                        onClick={() => handleDelete(tarea.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="tarea-body">
                    <div className="tarea-desc done-text">{tarea.descripcion}</div>
                    <div className="tarea-date">
                      {format(tarea.fecha.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Nueva Tarea</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Tipo de Tarea *</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  required
                >
                  {tiposTarea.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Descripción *</label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  required
                  rows="3"
                  placeholder="Describe la tarea..."
                />
              </div>

              <div className="input-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Número de Oveja (opcional)</label>
                <input
                  type="text"
                  name="ovejaId"
                  value={formData.ovejaId}
                  onChange={handleInputChange}
                  placeholder="Número de caravana"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
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
