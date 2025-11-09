import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Droplets, PawPrint, AlertCircle, Calendar } from 'lucide-react';
import { useCampo } from '../firebase/CampoContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
const SECTION_OPTIONS = [
  { key: 'stats', label: 'Estadísticas' },
  { key: 'tareas', label: 'Tareas del día' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOvejas: 0,
    ovejasGestantes: 0,
    produccionLeche: 0,
    lluviasMes: 0,
    tareasHoy: 0
  });
  const [loading, setLoading] = useState(true);
  const { selectedCampoId, loadingCampos } = useCampo();
  const [tareasResumen, setTareasResumen] = useState([]);
  const [visibleSections, setVisibleSections] = useState({
    stats: true,
    tareas: true
  });

  useEffect(() => {
    if (!selectedCampoId) {
      setLoading(false);
      return;
    }
    loadStats(selectedCampoId);
  }, [selectedCampoId]);

  async function loadStats(campoId) {
    try {
      // Total de ovejas activas
      const ovejasQuery = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', true)
      );
      const ovejasSnapshot = await getDocs(ovejasQuery);
      const totalOvejas = ovejasSnapshot.size;
      
      // Ovejas gestantes
      const gestantesQuery = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', true),
        where('reproductivo.gestante', '==', true)
      );
      const gestantesSnapshot = await getDocs(gestantesQuery);
      const ovejasGestantes = gestantesSnapshot.size;

      // Producción de leche (últimos 7 días)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      let totalLeche = 0;
      ovejasSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.produccionLeche) {
          data.produccionLeche.forEach(registro => {
            if (registro.fecha && registro.fecha.toDate() >= sevenDaysAgo) {
              totalLeche += registro.litros || 0;
            }
          });
        }
      });

      // Lluvias del mes
      const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lluviasQuery = query(
        collection(db, 'lluvias'),
        where('campoId', '==', campoId)
      );
      const lluviasSnapshot = await getDocs(lluviasQuery);
      
      let lluviasMes = 0;
      lluviasSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.fecha && data.fecha.toDate() >= firstDayMonth) {
          lluviasMes += data.milimetros || 0;
        }
      });

      // Tareas de hoy
      const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
      const todayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
      
      const tareasQuery = query(
        collection(db, 'tareas'),
        where('campoId', '==', campoId),
        where('completada', '==', false)
      );
      const tareasSnapshot = await getDocs(tareasQuery);
      
      let tareasHoy = 0;
      const proximas = [];
      tareasSnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.fecha) return;
        const fecha = data.fecha.toDate();
        if (fecha >= todayStart && fecha <= todayEnd) {
          tareasHoy++;
        }
        proximas.push({
          id: doc.id,
          descripcion: data.descripcion,
          tipo: data.tipo,
          fecha,
        });
      });

      proximas.sort((a, b) => a.fecha - b.fecha);

      const unique = [];
      const seen = new Set();
      for (const tarea of proximas) {
        if (!seen.has(tarea.id)) {
          unique.push(tarea);
          seen.add(tarea.id);
        }
      }
      setTareasResumen(unique.slice(0, 3));

      setStats({
        totalOvejas,
        ovejasGestantes,
        produccionLeche: Math.round(totalLeche * 10) / 10,
        lluviasMes: Math.round(lluviasMes * 10) / 10,
        tareasHoy
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loadingCampos || loading) {
    return (
      <div className="container">
        <div className="loading">Cargando estadísticas...</div>
      </div>
    );
  }

  if (!selectedCampoId) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ marginBottom: '10px' }}>Selecciona un campo</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Crea o elige un campo desde la sección Configuración para ver tus métricas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SECTION_OPTIONS.map((option) => (
            <label key={option.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={visibleSections[option.key]}
                onChange={(e) =>
                  setVisibleSections((prev) => ({ ...prev, [option.key]: e.target.checked }))
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {visibleSections.stats && (
        <div className="grid grid-2">
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PawPrint size={32} />
              <div>
                <div className="stat-label">Total de Ovejas</div>
                <div className="stat-value">{stats.totalOvejas}</div>
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={32} />
              <div>
                <div className="stat-label">Ovejas Gestantes</div>
                <div className="stat-value">{stats.ovejasGestantes}</div>
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #0288d1 0%, #03a9f4 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Droplets size={32} />
              <div>
                <div className="stat-label">Producción de Leche (7 días)</div>
                <div className="stat-value">{stats.produccionLeche}L</div>
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #00796b 0%, #009688 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Droplets size={32} />
              <div>
                <div className="stat-label">Lluvias del Mes</div>
                <div className="stat-value">{stats.lluviasMes}mm</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {visibleSections.chart && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h2 style={{ marginBottom: '10px' }}>Resumen de lluvias</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Este mes se registraron <strong>{stats.lluviasMes} mm</strong> de lluvia.
          </p>
          <Link to="/app/lluvias" className="btn btn-secondary" style={{ marginTop: '10px', width: 'fit-content' }}>
            Ver historial y gráficos
          </Link>
        </div>
      )}

      {visibleSections.tareas && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <Calendar size={24} color="var(--primary)" />
            <h2>Resumen rápido de tareas</h2>
          </div>
          {tareasResumen.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No tienes tareas pendientes para los próximos días.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tareasResumen.map((tarea) => (
                <li key={tarea.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{tarea.descripcion}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {format(tarea.fecha, "dd 'de' MMMM", { locale: es })}
                    </div>
                  </div>
                  <Link to="/app/tareas" className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                    Ver detalle
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
