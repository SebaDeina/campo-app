import { useEffect, useMemo, useState } from 'react';
import { MapPin, Link2 } from 'lucide-react';
import { 
  readStoredLocation, 
  saveStoredLocation, 
  clearStoredLocation 
} from '../utils/locationPreferences';

function extractCoordsFromGoogleMapsUrl(url) {
  if (!url) return null;

  const trimmed = url.trim();
  const atMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
  }

  const qMatch = trimmed.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
  }

  const coordsMatch = trimmed.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (coordsMatch) {
    return { lat: parseFloat(coordsMatch[1]), lon: parseFloat(coordsMatch[2]) };
  }

  return null;
}

export default function LocationSettings({
  onLocationChange,
  onLocationSaved,
  onLocationReset,
  title = 'Ubicación del Campo',
  description = 'Ingresa la latitud y longitud de tu campo para obtener datos precisos.',
  showHeader = true,
}) {
  const storedLocation = useMemo(() => readStoredLocation(), []);

  const [location, setLocation] = useState(storedLocation);
  const [locationForm, setLocationForm] = useState({
    lat: storedLocation?.lat?.toString() || '',
    lon: storedLocation?.lon?.toString() || ''
  });
  const [mapsUrl, setMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (onLocationChange) {
      onLocationChange(storedLocation || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showFeedback(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  function persistLocation(coords, { notify = true } = {}) {
    setLocation(coords);
    setLocationForm({
      lat: coords.lat.toString(),
      lon: coords.lon.toString()
    });
    saveStoredLocation(coords);
    if (notify && onLocationChange) {
      onLocationChange(coords);
    }
    if (notify && onLocationSaved) {
      onLocationSaved(coords);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const parsedLat = parseFloat(locationForm.lat);
    const parsedLon = parseFloat(locationForm.lon);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
      showFeedback('error', 'Latitud y longitud deben ser números válidos.');
      return;
    }

    setSaving(true);
    const newLocation = { lat: parsedLat, lon: parsedLon };
    persistLocation(newLocation);
    showFeedback('success', 'Ubicación guardada correctamente.');
    setSaving(false);
  }

  function handleReset() {
    clearStoredLocation();
    setLocation(null);
    setLocationForm({
      lat: '',
      lon: ''
    });
    if (onLocationChange) {
      onLocationChange(null);
    }
    if (onLocationReset) {
      onLocationReset(null);
    }
    setMapsUrl('');
    showFeedback('info', 'Ubicación eliminada. Configura una nueva ubicación cuando estés listo.');
  }

  function handleGoogleMapsImport() {
    const coords = extractCoordsFromGoogleMapsUrl(mapsUrl);
    if (!coords) {
      showFeedback('error', 'No se detectaron coordenadas en el enlace.');
      return;
    }

    persistLocation(coords);
    setMapsUrl('');
    showFeedback('success', 'Coordenadas detectadas y guardadas.');
  }

  return (
    <div className="card">
      {showHeader && (
        <>
          <h2 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MapPin size={22} color="var(--primary)" />
            {title}
          </h2>
          <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </>
      )}

      {feedback && (
        <div 
          className={`alert ${feedback.type === 'error' ? 'alert-error' : feedback.type === 'success' ? 'alert-success' : 'alert-info'}`} 
          style={{ marginBottom: '15px' }}
        >
          {feedback.message}
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}
      >
        <div className="input-group" style={{ flex: '1 1 200px' }}>
          <label>Latitud</label>
          <input
            type="number"
            step="any"
            name="lat"
            value={locationForm.lat}
            onChange={(e) => setLocationForm(prev => ({ ...prev, lat: e.target.value }))}
            required
          />
        </div>
        <div className="input-group" style={{ flex: '1 1 200px' }}>
          <label>Longitud</label>
          <input
            type="number"
            step="any"
            name="lon"
            value={locationForm.lon}
            onChange={(e) => setLocationForm(prev => ({ ...prev, lon: e.target.value }))}
            required
          />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={saving}
          style={{ height: '42px', padding: '0 20px' }}
        >
          {saving ? 'Guardando...' : 'Guardar ubicación'}
        </button>
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={handleReset}
          style={{ height: '42px', padding: '0 20px' }}
        >
          Restablecer
        </button>
        <div className="input-group" style={{ flex: '1 1 100%' }}>
          <label>Enlace de Google Maps (opcional)</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Link2 
                size={16} 
                color="var(--text-secondary)" 
                style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
            <button 
              type="button" 
              className="btn"
              onClick={handleGoogleMapsImport}
              style={{ padding: '0 20px', height: '42px', background: 'var(--border)' }}
            >
              Usar enlace
            </button>
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>
            Abre Google Maps, toca en compartir y pega el enlace aquí para detectar automáticamente las coordenadas.
          </small>
        </div>
      </form>
    </div>
  );
}
