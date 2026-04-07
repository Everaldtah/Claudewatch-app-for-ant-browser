import { useState, useEffect } from 'react';

export type Device = 'watch' | 'phone' | 'desktop';

function detectDevice(width: number): Device {
  if (typeof window === 'undefined') return 'desktop';

  const params = new URLSearchParams(window.location.search);
  const override = params.get('view') as Device | null;
  if (override && ['watch', 'phone', 'desktop'].includes(override)) return override;

  const ua = navigator.userAgent;
  if (width <= 260 || /Watch|watchOS/i.test(ua)) return 'watch';
  if (/Mobi|Android|iPhone|iPad/i.test(ua) || width <= 768) return 'phone';
  return 'desktop';
}

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    const update = () => setDevice(detectDevice(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return device;
}
