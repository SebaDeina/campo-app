import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, CloudRain, Sun, Wind, Droplets, Eye, Gauge } from 'lucide-react';
import LocationSettings from '../components/LocationSettings';
import { readStoredLocation } from '../utils/locationPreferences';

export default function Clima() {
  const [clima, setClima] = useState(null);
  const [pronostico, setPronostico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ubicacion, setUbicacion] = useState(null);
  const [location, setLocation] = useState(() => readStoredLocation());
  const [hasCustomLocation, setHasCustomLocation] = useState(() => Boolean(readStoredLocation()));

  const API_KEY = 'd0cbb6d4d6401dd7894e6f6bc0eb131c'; // Obtener en https://openweathermap.org/api

  const loadClima = useCallback(async (coords) => {
    if (!coords?.lat || !coords?.lon) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');

      // Clima actual
      const climaResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=metric&lang=es`
      );
      
      const climaData = await climaResponse.json();
      if (!climaResponse.ok) {
        throw new Error(climaData?.message || 'Error al obtener el clima. Verifica tu API key.');
      }
      setClima(climaData);
      setUbicacion({
        lat: coords.lat,
        lon: coords.lon,
        ciudad: climaData.name || 'Ubicación configurada'
      });

      // Pronóstico 5 días
      const pronosticoResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=metric&lang=es`
      );
      
      const pronosticoData = await pronosticoResponse.json();
      if (!pronosticoResponse.ok) {
        throw new Error(pronosticoData?.message || 'Error al obtener el pronóstico');
      }
      
      // Filtrar para obtener un pronóstico por día (mediodía)
      const pronosticoDiario = pronosticoData.list.filter((item, index) => 
        index % 8 === 0
      ).slice(0, 5);
      
      setPronostico(pronosticoDiario);
    } catch (error) {
      console.error('Error cargando clima:', error);
      setError(error.message || 'Error al cargar datos del clima');
    } finally {
      setLoading(false);
    }
  }, [API_KEY]);

  useEffect(() => {
    if (location?.lat && location?.lon) {
      loadClima(location);
    }
  }, [location, loadClima]);

  const rainProjection = useMemo(() => {
    if (!pronostico.length) return null;

    const formatter = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    });

    const entries = pronostico.map(item => {
      const date = new Date(item.dt * 1000);
      const label = formatter.format(date);
      return {
        date,
        label,
        pop: item.pop ?? 0,
        description: item.weather?.[0]?.description || '',
      };
    });

    const rainyEntries = entries.filter(entry => entry.pop > 0);
    if (!rainyEntries.length) {
      return {
        hasRain: false,
        summary: [],
      };
    }

    const highest = rainyEntries.reduce((prev, curr) => (curr.pop > prev.pop ? curr : prev));
    const averageChance = Math.round(
      (rainyEntries.reduce((sum, entry) => sum + entry.pop, 0) / rainyEntries.length) * 100
    );
    const summary = [...rainyEntries]
      .sort((a, b) => b.pop - a.pop)
      .slice(0, 3)
      .map(entry => ({
        label: entry.label,
        chance: Math.round(entry.pop * 100),
        description: entry.description
      }));

    return {
      hasRain: true,
      topDay: {
        label: highest.label,
        chance: Math.round(highest.pop * 100),
        description: highest.description
      },
      averageChance,
      summary
    };
  }, [pronostico]);

  function getWeatherIcon(iconCode) {
    const iconMap = {
      '01d': <Sun size={48} color="#FFA726" />,
      '01n': <Sun size={48} color="#FFA726" />,
      '02d': <Cloud size={48} color="#78909C" />,
      '02n': <Cloud size={48} color="#78909C" />,
      '03d': <Cloud size={48} color="#78909C" />,
      '03n': <Cloud size={48} color="#78909C" />,
      '04d': <Cloud size={48} color="#607D8B" />,
      '04n': <Cloud size={48} color="#607D8B" />,
      '09d': <CloudRain size={48} color="#0288D1" />,
      '09n': <CloudRain size={48} color="#0288D1" />,
      '10d': <CloudRain size={48} color="#0288D1" />,
      '10n': <CloudRain size={48} color="#0288D1" />,
      '11d': <CloudRain size={48} color="#1565C0" />,
      '11n': <CloudRain size={48} color="#1565C0" />,
    };

    return iconMap[iconCode] || <Cloud size={48} color="#78909C" />;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('es-AR', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '30px' }}>Clima y Pronóstico</h1>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <h3>⚠️ {error}</h3>
          <p style={{ marginTop: '10px' }}>
            Revisa tu API key o actualiza la ubicación del campo para volver a intentarlo.
          </p>
          <button onClick={() => loadClima(location)} className="btn btn-primary" style={{ marginTop: '15px' }}>
            Reintentar
          </button>
        </div>
      )}

      {!hasCustomLocation && (
        <LocationSettings
          onLocationChange={(coords) => {
            setError('');
            setLocation(coords);
          }}
          onLocationSaved={() => setHasCustomLocation(true)}
          onLocationReset={() => setHasCustomLocation(false)}
        />
      )}

      {hasCustomLocation && (
        <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <span>La ubicación del campo ya está configurada. Puedes actualizarla desde la sección de configuración.</span>
          <Link 
            to="/app/configuracion#ubicacion" 
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Editar ubicación
          </Link>
        </div>
      )}

      {rainProjection && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginBottom: '8px', color: 'var(--primary)' }}>Proyección de lluvia semanal</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Probabilidades calculadas con el pronóstico extendido de OpenWeather (actualizado cada 3 horas).
              </p>
            </div>
            {rainProjection.hasRain && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0288D1' }}>
                  {rainProjection.topDay.chance}%
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Máxima probabilidad de lluvia
                </div>
              </div>
            )}
          </div>

          {rainProjection.hasRain ? (
            <>
              <div style={{ marginTop: '15px', padding: '15px', borderRadius: '8px', background: 'var(--background)' }}>
                <strong>{rainProjection.topDay.label}</strong> es el día con mayor chance de lluvia ({rainProjection.topDay.chance}%).
                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', marginLeft: '5px' }}>
                  {rainProjection.topDay.description}
                </span>
              </div>

              <div style={{ marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {rainProjection.summary.map((dia) => (
                  <div 
                    key={dia.label} 
                    style={{ 
                      flex: '1 1 160px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '600', textTransform: 'capitalize' }}>{dia.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0288D1' }}>{dia.chance}%</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {dia.description || 'Lluvias probables'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '15px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Promedio de probabilidad entre los días lluviosos: <strong>{rainProjection.averageChance}%</strong>.
              </div>
            </>
          ) : (
            <p style={{ marginTop: '15px', color: 'var(--text-secondary)' }}>
              No se esperan lluvias en la próxima semana según el pronóstico actual.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="loading">Cargando datos del clima...</div>
        </div>
      )}

      {!loading && !clima && !error && (
        <div className="alert alert-info">
          Configura la ubicación del campo para ver el clima actualizado.
        </div>
      )}

      {clima && (
        <>
          <div className="card" style={{ marginBottom: '30px' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>
              Clima Actual - {ubicacion?.ciudad || 'Ubicación configurada'}
            </h2>
            
            <div className="grid grid-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {getWeatherIcon(clima.weather[0].icon)}
                <div>
                  <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {Math.round(clima.main.temp)}°C
                  </div>
                  <div style={{ fontSize: '18px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {clima.weather[0].description}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Droplets size={24} color="#0288D1" />
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Humedad</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{clima.main.humidity}%</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Wind size={24} color="#558B2F" />
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Viento</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Math.round(clima.wind.speed * 3.6)} km/h</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Gauge size={24} color="#D32F2F" />
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Presión</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{clima.main.pressure} hPa</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Eye size={24} color="#7B1FA2" />
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Visibilidad</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {clima.visibility ? (clima.visibility / 1000).toFixed(1) : 'N/A'} km
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--background)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span>Sensación térmica: <strong>{Math.round(clima.main.feels_like)}°C</strong></span>
                <span>Temp. mín: <strong>{Math.round(clima.main.temp_min)}°C</strong></span>
                <span>Temp. máx: <strong>{Math.round(clima.main.temp_max)}°C</strong></span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>
              Pronóstico Extendido
            </h2>
            
            <div className="grid grid-3">
              {pronostico.map((dia, index) => (
                <div key={index} className="card" style={{ background: 'var(--background)', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'capitalize' }}>
                    {formatDate(dia.dt)}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
                    {getWeatherIcon(dia.weather[0].icon)}
                  </div>
                  
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '5px' }}>
                    {Math.round(dia.main.temp)}°C
                  </div>
                  
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '10px' }}>
                    {dia.weather[0].description}
                  </div>
                  
                  {dia.pop > 0 && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#0288D1', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '5px'
                    }}>
                      <CloudRain size={16} />
                      {Math.round(dia.pop * 100)}% lluvia
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {pronostico.some(dia => dia.pop > 0.3) && (
            <div className="alert alert-info" style={{ marginTop: '20px' }}>
              <strong>⚠️ Alerta de lluvia:</strong> Se pronostica lluvia en los próximos días. 
              Considera planificar las actividades del campo en consecuencia.
            </div>
          )}
        </>
      )}
    </div>
  );
}
