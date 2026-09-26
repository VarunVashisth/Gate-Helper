import { useCallback, useEffect, useState } from 'react';
import type { OllamaStatus } from '../../shared/contracts/api';

type StatusState = {
  data: OllamaStatus | null;
  loading: boolean;
  error: string | null;
};

export const useOllamaStatus = () => {
  const [status, setStatus] = useState<StatusState>({
    data: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await window.gateHelper.tutor.getStatus();
      setStatus({ data, loading: false, error: null });
    } catch (error) {
      setStatus({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not check Ollama.',
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void window.gateHelper.tutor
      .getStatus()
      .then((data) => {
        if (active) setStatus({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Could not check Ollama.',
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...status, refresh };
};
