'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === 'light'), []);
  function toggle() {
    const next = light ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setLight(!light);
  }
  return (
    <button onClick={toggle} aria-label="Toggle theme" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg">
      {light ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
