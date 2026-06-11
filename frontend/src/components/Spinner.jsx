import { useState, useEffect } from 'react';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export default function Spinner({ className = '' }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span className={`spinner ${className}`}>{FRAMES[i]}</span>;
}
