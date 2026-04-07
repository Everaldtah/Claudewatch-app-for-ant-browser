import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  serverURL: string;
  authToken: string;
  sessionID: string;
}

const KEY = 'claudewatch.settings.v1';

const defaults: Settings = {
  serverURL: '',
  authToken: '',
  sessionID: '',
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        setSettings({ ...defaults, ...JSON.parse(raw) });
      }
    } catch {
      // localStorage unavailable or corrupt — use defaults
    }
  }, []);

  const saveSettings = useCallback((next: Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore write failures
    }
  }, []);

  return { settings, saveSettings };
}
