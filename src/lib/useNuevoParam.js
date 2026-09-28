import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Los accesos directos del header llevan a /app/<página>?nuevo=<qué>. La página
// llama a este hook para abrir el formulario correspondiente apenas esté lista
// (`ready`), y el parámetro se limpia para que recargar no lo vuelva a abrir.
export function useNuevoParam(onNuevo, ready = true) {
  const [params, setParams] = useSearchParams();
  const nuevo = params.get('nuevo');

  useEffect(() => {
    if (!nuevo || !ready) return;
    onNuevo(nuevo);
    const next = new URLSearchParams(params);
    next.delete('nuevo');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevo, ready]);
}
