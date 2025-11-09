import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, writeBatch, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCampo } from '../firebase/CampoContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

function dateFromInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

function parseImportedDate(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12));
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  }
  const text = String(value).trim();
  if (!text) return null;
  const isoLike = text.replace(/\./g, '-').replace(/\//g, '-');
  const parts = isoLike.split('-');
  if (parts.length === 3) {
    const [a, b, c] = parts.map((p) => p.padStart(2, '0'));
    const year = c.length === 4 ? Number(c) : Number(a);
    const month = c.length === 4 ? Number(b) : Number(b);
    const day = c.length === 4 ? Number(a) : Number(c);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));
    }
  }
  const parsed = new Date(text);
  if (!isNaN(parsed)) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12));
  }
  return null;
}

function normalizeRow(row) {
  const fechaRaw = extractField(row, ['fecha', 'Fecha', 'FECHA', 'date', 'Date']);
  const cantidadRaw = extractField(row, ['cantidad', 'Cantidad', 'mm', 'MM', 'milimetros', 'Milimetros', 'valor']);
  if (fechaRaw == null || cantidadRaw == null) return null;
  const fecha = parseImportedDate(fechaRaw);
  const milimetros = Number(cantidadRaw);
  if (!fecha || Number.isNaN(milimetros)) return null;
  return { fecha, milimetros };
}

function extractField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

function parseCsvOrTxt(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject
    });
  });
}

async function parseXlsx(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

export default function Lluvias() {
  const [lluvias, setLluvias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importFeedback, setImportFeedback] = useState(null);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    milimetros: ''
  });
  const { selectedCampoId, loadingCampos } = useCampo();

  useEffect(() => {
    if (!selectedCampoId) {
      setLluvias([]);
      setLoading(false);
      return;
    }
    loadLluvias(selectedCampoId);
  }, [selectedCampoId]);

  async function loadLluvias(campoId) {
    try {
      const q = query(
        collection(db, 'lluvias'),
        where('campoId', '==', campoId),
        orderBy('fecha', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const lluviasData = [];
      
      querySnapshot.forEach((doc) => {
        lluviasData.push({ id: doc.id, ...doc.data() });
      });
      
      setLluvias(lluviasData);
    } catch (error) {
      console.error('Error cargando lluvias:', error);
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
      alert('Selecciona un campo antes de registrar lluvias.');
      return;
    }
    
    try {
      await addDoc(collection(db, 'lluvias'), {
        fecha: dateFromInput(formData.fecha),
        milimetros: parseFloat(formData.milimetros),
        campoId: selectedCampoId,
        createdAt: new Date()
      });
      
      setShowModal(false);
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        milimetros: ''
      });
      loadLluvias(selectedCampoId);
    } catch (error) {
      console.error('Error guardando lluvia:', error);
      alert('Error al guardar el registro');
    }
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!selectedCampoId || !importFile) {
      setImportFeedback({ type: 'error', message: 'Selecciona un archivo y un campo antes de importar.' });
      return;
    }

    setImporting(true);
    setImportFeedback(null);

    try {
      const ext = importFile.name.split('.').pop().toLowerCase();
      let rows = [];
      if (ext === 'csv' || ext === 'txt') {
        rows = await parseCsvOrTxt(importFile);
      } else if (ext === 'xlsx' || ext === 'xls') {
        rows = await parseXlsx(importFile);
      } else {
        throw new Error('Formato no soportado. Usa .csv, .txt o .xlsx');
      }

      const entries = rows
        .map(normalizeRow)
        .filter(Boolean);

      if (!entries.length) {
        throw new Error('No se encontraron filas válidas con columnas "fecha" y "cantidad".');
      }

      const batch = writeBatch(db);
      entries.forEach((entry) => {
        const ref = doc(collection(db, 'lluvias'));
        batch.set(ref, {
          fecha: Timestamp.fromDate(entry.fecha),
          milimetros: entry.milimetros,
          campoId: selectedCampoId,
          createdAt: Timestamp.fromDate(new Date()),
          fuente: 'archivo'
        });
      });

      await batch.commit();
      setImportFeedback({ type: 'success', message: `Importaste ${entries.length} registros.` });
      setShowImportModal(false);
      setImportFile(null);
      loadLluvias(selectedCampoId);
    } catch (error) {
      console.error('Error importando registros:', error);
      setImportFeedback({ type: 'error', message: error.message || 'No se pudo importar el archivo.' });
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id) {
    if (window.confirm('¿Estás seguro de eliminar este registro?')) {
      try {
        await deleteDoc(doc(db, 'lluvias', id));
        loadLluvias(selectedCampoId);
      } catch (error) {
        console.error('Error eliminando registro:', error);
      }
    }
  }

  function prepareMonthlyChartData() {
    const monthMap = new Map();

    lluvias.forEach(lluvia => {
      const date = lluvia.fecha.toDate();
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          date: new Date(date.getFullYear(), date.getMonth(), 1),
          label: format(date, "MMM yyyy", { locale: es }),
          total: 0
        });
      }

      monthMap.get(key).total += lluvia.milimetros;
    });

    const data = Array.from(monthMap.values())
      .sort((a, b) => a.date - b.date);

    const monthlyAverage = data.length
      ? Math.round((data.reduce((sum, item) => sum + item.total, 0) / data.length) * 10) / 10
      : 0;

    return {
      average: monthlyAverage,
      data: data.map(item => ({
        label: item.label,
        total: Math.round(item.total * 10) / 10,
        averageLine: monthlyAverage
      }))
    };
  }

  function calculateMonthlyStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthData = lluvias.filter(lluvia => {
      const fecha = lluvia.fecha.toDate();
      return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear;
    });

    const total = currentMonthData.reduce((sum, lluvia) => sum + lluvia.milimetros, 0);
    const promedio = currentMonthData.length > 0 ? total / currentMonthData.length : 0;
    const maximo = currentMonthData.length > 0 ? Math.max(...currentMonthData.map(l => l.milimetros)) : 0;

    return {
      total: Math.round(total * 10) / 10,
      promedio: Math.round(promedio * 10) / 10,
      maximo: Math.round(maximo * 10) / 10,
      dias: currentMonthData.length
    };
  }

  const stats = calculateMonthlyStats();
  const monthlyChart = prepareMonthlyChartData();

  if (loadingCampos || loading) {
    return (
      <div className="container">
        <div className="loading">Cargando registros...</div>
      </div>
    );
  }

  if (!selectedCampoId) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ marginBottom: '10px' }}>Selecciona un campo</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Usa el selector de la barra superior o crea un campo en Configuración para registrar lluvias.
          </p>
        </div>
      </div>
    );
  }

  const actionRowStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    width: '100%',
  };

  const importButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f4f7f3',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    flex: '1 1 200px',
  };

  const primaryButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1 1 200px',
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '15px', flexWrap: 'wrap' }}>
        <h1>Registro de Lluvias</h1>
        <div style={actionRowStyle}>
          <button 
            onClick={() => {
              setShowImportModal(true);
              setImportFeedback(null);
            }}
            className="btn"
            style={importButtonStyle}
          >
            <Upload size={18} />
            Importar archivo
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={primaryButtonStyle}
          >
            <Plus size={20} />
            Registrar Lluvia
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '30px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>Estadísticas del Mes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>
                {stats.total} mm
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Promedio</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--secondary)' }}>
                {stats.promedio} mm
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Máximo</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0288d1' }}>
                {stats.maximo} mm
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Días con lluvia</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                {stats.dias}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>Lluvia mensual vs promedio</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthlyChart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total mensual (mm)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              {monthlyChart.data.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="averageLine"
                  name={`Promedio (${monthlyChart.average} mm)`}
                  stroke="#0288D1"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {lluvias.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
            No hay registros de lluvia. ¡Agrega el primer registro!
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Historial de Lluvias</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Milímetros</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lluvias.map(lluvia => (
                <tr key={lluvia.id}>
                  <td>
                    {format(lluvia.fecha.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>{lluvia.milimetros} mm</strong>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(lluvia.id)}
                      className="btn btn-danger"
                      style={{ padding: '6px 12px' }}
                    >
                      <Trash2 size={16} />
                    </button>
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
              <h2 className="modal-title">Registrar Lluvia</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
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
                <label>Milímetros *</label>
                <input
                  type="number"
                  name="milimetros"
                  value={formData.milimetros}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0"
                  required
                  placeholder="Ej: 15.5"
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

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Importar datos de lluvia</h2>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="close-btn">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit}>
              <div className="input-group">
                <label>Archivo (.csv, .txt, .xlsx)</label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                El archivo debe incluir columnas <strong>fecha</strong> y <strong>cantidad</strong> (en milímetros).
                Cada fila se importará al campo seleccionado actualmente.
              </p>
              {importFeedback && (
                <div className={`alert ${importFeedback.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                  {importFeedback.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="btn btn-primary" disabled={!importFile || importing}>
                  {importing ? 'Importando...' : 'Importar'}
                </button>
                <button type="button" className="btn" style={{ background: 'var(--border)' }} onClick={() => { setShowImportModal(false); setImportFile(null); }}>
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
