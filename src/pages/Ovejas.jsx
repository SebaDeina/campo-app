import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useCampo } from '../firebase/CampoContext';

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
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
    activa: true
  });

  const { selectedCampoId, loadingCampos } = useCampo();

  useEffect(() => {
    if (!selectedCampoId) {
      setOvejas([]);
      setLoading(false);
      return;
    }
    loadOvejas(selectedCampoId);
  }, [selectedCampoId]);

  async function loadOvejas(campoId) {
    try {
      const q = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const ovejasData = [];
      
      querySnapshot.forEach((doc) => {
        ovejasData.push({ id: doc.id, ...doc.data() });
      });
      
      setOvejas(ovejasData);
    } catch (error) {
      console.error('Error cargando ovejas:', error);
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
      alert('Selecciona un campo antes de registrar ovejas.');
      return;
    }
    
    try {
      const ovejaData = {
        ...formData,
        fechaNacimiento: dateFromInput(formData.fechaNacimiento),
        peso: [{
          fecha: new Date(),
          valor: parseFloat(formData.peso)
        }],
        produccionLeche: [],
        enfermedades: [],
        reproductivo: {
          gestante: false,
          ultimoParto: null,
          ultimaInseminacion: null,
          fechaProximoParto: null
        },
        campoId: selectedCampoId,
        createdAt: new Date()
      };

      if (editingOveja) {
        await updateDoc(doc(db, 'ovejas', editingOveja.id), ovejaData);
      } else {
        await addDoc(collection(db, 'ovejas'), ovejaData);
      }
      
      setShowModal(false);
      setEditingOveja(null);
      resetForm();
      loadOvejas(selectedCampoId);
    } catch (error) {
      console.error('Error guardando oveja:', error);
      alert('Error al guardar la oveja');
    }
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
      activa: true
    });
  }

  function handleEdit(oveja) {
    setEditingOveja(oveja);
    setFormData({
      numeroCaravana: oveja.numeroCaravana || '',
      fechaNacimiento: oveja.fechaNacimiento?.toDate().toISOString().split('T')[0] || '',
      peso: oveja.peso?.[oveja.peso.length - 1]?.valor || '',
      sexo: oveja.sexo || 'hembra',
      raza: oveja.raza || '',
      madre: oveja.madre || '',
      padre: oveja.padre || '',
      activa: oveja.activa !== false
    });
    setShowModal(true);
  }

  async function handleDelete(id) {
    if (window.confirm('¿Estás seguro de eliminar esta oveja?')) {
      try {
        await updateDoc(doc(db, 'ovejas', id), { activa: false });
        loadOvejas(selectedCampoId);
      } catch (error) {
        console.error('Error eliminando oveja:', error);
        alert('Error al eliminar la oveja');
      }
    }
  }

  function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 'N/A';
    const hoy = new Date();
    const nacimiento = fechaNacimiento.toDate();
    const meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + 
                   hoy.getMonth() - nacimiento.getMonth();
    
    if (meses < 12) return `${meses} meses`;
    const años = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    return `${años} año${años > 1 ? 's' : ''} ${mesesRestantes > 0 ? `y ${mesesRestantes} meses` : ''}`;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Gestión de Ovejas</h1>
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

      {ovejas.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
            No hay ovejas registradas. ¡Agrega tu primera oveja!
          </p>
        </div>
      ) : (
        <div className="card">
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
              {ovejas.map(oveja => (
                <tr key={oveja.id}>
                  <td><strong>{oveja.numeroCaravana}</strong></td>
                  <td>{oveja.raza || 'N/A'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{oveja.sexo}</td>
                  <td>{calcularEdad(oveja.fechaNacimiento)}</td>
                  <td>{oveja.peso?.[oveja.peso.length - 1]?.valor || 'N/A'} kg</td>
                  <td>
                    {oveja.reproductivo?.gestante ? (
                      <span style={{ 
                        background: '#7b1fa2', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        Gestante
                      </span>
                    ) : (
                      <span style={{ 
                        background: 'var(--primary)', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        Normal
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleEdit(oveja)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(oveja.id)}
                        className="btn btn-danger"
                        style={{ padding: '6px 12px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingOveja ? 'Editar Oveja' : 'Agregar Nueva Oveja'}
              </h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Número de Caravana *</label>
                <input
                  type="text"
                  name="numeroCaravana"
                  value={formData.numeroCaravana}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Fecha de Nacimiento *</label>
                <input
                  type="date"
                  name="fechaNacimiento"
                  value={formData.fechaNacimiento}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Peso Inicial (kg) *</label>
                <input
                  type="number"
                  name="peso"
                  value={formData.peso}
                  onChange={handleInputChange}
                  step="0.1"
                  required
                />
              </div>

              <div className="input-group">
                <label>Sexo *</label>
                <select
                  name="sexo"
                  value={formData.sexo}
                  onChange={handleInputChange}
                  required
                >
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
                <label>ID Madre (opcional)</label>
                <input
                  type="text"
                  name="madre"
                  value={formData.madre}
                  onChange={handleInputChange}
                  placeholder="Número de caravana de la madre"
                />
              </div>

              <div className="input-group">
                <label>ID Padre (opcional)</label>
                <input
                  type="text"
                  name="padre"
                  value={formData.padre}
                  onChange={handleInputChange}
                  placeholder="Número de caravana del padre"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingOveja ? 'Actualizar' : 'Guardar'}
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
