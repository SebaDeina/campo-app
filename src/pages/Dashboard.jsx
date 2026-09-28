import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from '../lib/db';
import { calcularStock, stockBajo } from '../lib/alimento';
import { db } from '../firebase/config';
import { Droplets, PawPrint, AlertCircle, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { useCampo } from '../firebase/CampoContext';
import { format, differenceInDays, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOvejas: 0,
    ovejasGestantes: 0,
    produccionLeche: 0,
    lluviasMes: 0,
    tareasHoy: 0,
    tareasPendientes: 0
  });
  const [loading, setLoading] = useState(true);
  const { selectedCampoId, loadingCampos } = useCampo();
  const [tareasProximas, setTareasProximas] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!selectedCampoId) {
      setLoading(false);
      return;
    }
    loadStats(selectedCampoId);
  }, [selectedCampoId]);

  async function loadStats(campoId) {
    try {
      const today = new Date();
      const todayStart = startOfDay(today);

      // Stock: ovejas activas (no están en la papelera) y sin baja (faena, muerte, venta...)
      const ovejasQuery = query(
        collection(db, 'ovejas'),
        where('campoId', '==', campoId),
        where('activa', '==', true)
      );
      const ovejasSnapshot = await getDocs(ovejasQuery);
      const enStock = ovejasSnapshot.docs.map((d) => d.data()).filter((data) => !data.baja);
      const totalOvejas = enStock.length;

      // Ovejas gestantes y alertas de parto
      const gestantes = enStock.filter((data) => data.reproductivo?.gestante === true);
      const ovejasGestantes = gestantes.length;

      // Calcular alertas de ovejas próximas a parir (< 30 días)
      const newAlerts = [];
      gestantes.forEach((data) => {
        if (data.reproductivo?.fechaParto) {
          const fechaParto = data.reproductivo.fechaParto.toDate();
          const diasRestantes = differenceInDays(fechaParto, today);
          if (diasRestantes > 0 && diasRestantes <= 30) {
            newAlerts.push({
              type: 'warning',
              message: `Oveja ${data.numeroCaravana || 'sin caravana'} próxima a parir en ${diasRestantes} días`,
              link: '/app/ovejas'
            });
          }
        }
      });

      // Producción de leche (últimos 7 días)
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

      // Tareas
      const tareasQuery = query(
        collection(db, 'tareas'),
        where('campoId', '==', campoId),
        where('completada', '==', false)
      );
      const tareasSnapshot = await getDocs(tareasQuery);

      let tareasHoy = 0;
      let tareasPendientes = 0;
      const proximas = [];

      tareasSnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.fecha) return;

        const fecha = data.fecha.toDate();
        const fechaStart = startOfDay(fecha);

        tareasPendientes++;

        if (fechaStart.getTime() === todayStart.getTime()) {
          tareasHoy++;
        }

        // Alertas de tareas vencidas
        if (isBefore(fechaStart, todayStart)) {
          newAlerts.push({
            type: 'error',
            message: `Tarea vencida: ${data.descripcion}`,
            link: '/app/tareas'
          });
        }

        proximas.push({
          id: doc.id,
          descripcion: data.descripcion,
          tipo: data.tipo,
          fecha,
          vencida: isBefore(fechaStart, todayStart)
        });
      });

      // Ordenar tareas: vencidas primero, luego por fecha
      proximas.sort((a, b) => {
        if (a.vencida && !b.vencida) return -1;
        if (!a.vencida && b.vencida) return 1;
        return a.fecha - b.fecha;
      });

      setTareasProximas(proximas.slice(0, 5));
      // Stock de alimento bajo el mínimo
      const [alimentosSnap, movsSnap] = await Promise.all([
        getDocs(query(collection(db, 'alimentos'), where('campoId', '==', campoId))),
        getDocs(query(collection(db, 'alimentoMovimientos'), where('campoId', '==', campoId))),
      ]);
      const movsAlimento = movsSnap.docs.map((d) => d.data());
      alimentosSnap.forEach((d) => {
        const alimento = d.data();
        if (alimento.activo === false) return;
        const stock = calcularStock(movsAlimento.filter((m) => m.alimentoId === d.id));
        if (stockBajo(stock, alimento.stockMinimo)) {
          newAlerts.push({
            type: 'warning',
            message: `Stock bajo: ${alimento.nombre} — quedan ${stock.toLocaleString('es-AR')} ${alimento.unidad} (mínimo ${alimento.stockMinimo})`,
            link: '/app/alimento'
          });
        }
      });

      setAlerts(newAlerts);

      setStats({
        totalOvejas,
        ovejasGestantes,
        produccionLeche: Math.round(totalLeche * 10) / 10,
        lluviasMes: Math.round(lluviasMes * 10) / 10,
        tareasHoy,
        tareasPendientes
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
      <div style={{ marginBottom: '25px' }}>
        <h1 style={{ marginBottom: '5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Resumen ejecutivo de tu campo
        </p>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          {alerts.map((alert, index) => (
            <Link
              key={index}
              to={alert.link}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="alert"
                style={{
                  background: alert.type === 'error' ? '#fee' : '#fff3cd',
                  border: `1px solid ${alert.type === 'error' ? '#fcc' : '#ffe69c'}`,
                  color: alert.type === 'error' ? '#c00' : '#856404',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer'
                }}
              >
                <AlertCircle size={20} />
                <span>{alert.message}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-2" style={{ marginBottom: '25px' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PawPrint size={32} />
            <div>
              <div className="stat-label">Stock de ovejas</div>
              <div className="stat-value">{stats.totalOvejas}</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={32} />
            <div>
              <div className="stat-label">Ovejas Gestantes</div>
              <div className="stat-value">{stats.ovejasGestantes}</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Droplets size={32} />
            <div>
              <div className="stat-label">Lluvias del Mes</div>
              <div className="stat-value">{stats.lluviasMes}mm</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={32} />
            <div>
              <div className="stat-label">Tareas Pendientes</div>
              <div className="stat-value">{stats.tareasPendientes}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>{stats.tareasHoy} para hoy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tareas próximas */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="var(--primary)" />
            Tareas próximas
          </h3>
          <Link to="/app/tareas" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '14px' }}>
            Ver todas
          </Link>
        </div>

        {tareasProximas.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            ¡Excelente! No tienes tareas pendientes.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tareasProximas.map((tarea) => (
              <div
                key={tarea.id}
                className="card"
                style={{
                  background: tarea.vencida ? '#fee' : 'var(--background)',
                  border: tarea.vencida ? '1px solid #fcc' : '1px solid var(--border)',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {tarea.vencida ? (
                      <AlertCircle size={16} color="#c00" />
                    ) : (
                      <Clock size={16} color="var(--primary)" />
                    )}
                    <strong style={{ color: tarea.vencida ? '#c00' : 'inherit' }}>
                      {tarea.descripcion}
                    </strong>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                    {format(tarea.fecha, "dd 'de' MMMM, yyyy", { locale: es })}
                    {tarea.vencida && <span style={{ color: '#c00', marginLeft: '8px' }}>• Vencida</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
