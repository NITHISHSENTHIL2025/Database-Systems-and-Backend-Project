import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useApiData(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api(path);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { reload().catch(() => {}); }, [reload, ...deps]);

  return { data, setData, error, loading, reload };
}
