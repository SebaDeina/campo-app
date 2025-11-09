export const DEFAULT_LOCATION = {
  lat: -34.6037,
  lon: -58.3816,
  ciudad: 'Buenos Aires'
};

export const LOCATION_STORAGE_KEY = 'campoAppLocation';

export function readStoredLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number'
    ) {
      return parsed;
    }
  } catch (error) {
    console.error('No se pudo leer la ubicación guardada:', error);
  }

  return null;
}

export function saveStoredLocation(coords) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coords));
  } catch (error) {
    console.error('No se pudo guardar la ubicación:', error);
  }
}

export function clearStoredLocation() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCATION_STORAGE_KEY);
}
