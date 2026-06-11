import { useState, useEffect, useRef } from 'react';
import Spinner from './Spinner';

// Animates a number from 0 to target over ~900ms
function useCountUp(target) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) { setDisplay(0); return; }
    const start = performance.now();
    const duration = 900;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(parseFloat((target * eased).toFixed(1)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

function SpeedRow({ label, value, max, colorVar, compare, diff }) {
  const animated = useCountUp(value);
  const pct = max > 0 ? Math.min(animated / max, 1) * 100 : 0;

  return (
    <div className="speed-row">
      <div className="speed-row-head">
        <span className="speed-label">{label}</span>
        <span className="speed-val">
          {animated.toFixed(1)} <span className="speed-unit">Mbps</span>
        </span>
      </div>
      <div className="speed-track">
        <div className="speed-fill" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
      {compare && diff !== null && (
        <div className={`speed-diff ${diff >= 0 ? 'cmp-up' : 'cmp-down'}`}>
          {diff >= 0 ? '+' : '−'}{Math.abs(diff).toFixed(1)} Mbps vs no vpn
        </div>
      )}
    </div>
  );
}

export default function SpeedTest({ vpn }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase]     = useState('idle'); // idle | testing | done
  const [before, setBefore]   = useState(null);
  const [after, setAfter]     = useState(null);

  const isConnected = vpn.status === 'connected';

  const run = async () => {
    setRunning(true);
    setPhase('testing');
    const viaVpn = isConnected;
    try {
      const r = await vpn.RunSpeedTest();
      if (r.error) {
        vpn.appendLog('speedtest error: ' + r.error, 'error');
        setPhase('idle');
      } else {
        const result = { ...r, viaVpn };
        if (viaVpn) setAfter(result); else setBefore(result);
        vpn.appendLog(
          `speedtest (${viaVpn ? 'via vpn' : 'no vpn'}): ↓ ${r.downloadMbps} Mbps  ↑ ${r.uploadMbps} Mbps`,
          'ok'
        );
        setPhase('done');
      }
    } catch (e) {
      vpn.appendLog('speedtest failed: ' + e, 'error');
      setPhase('idle');
    }
    setRunning(false);
  };

  const latest   = after || before;
  const hasBoth  = before && after;
  const dlDiff   = hasBoth ? after.downloadMbps - before.downloadMbps : null;
  const ulDiff   = hasBoth ? after.uploadMbps   - before.uploadMbps   : null;

  const maxVal = latest
    ? Math.max(50, Math.ceil(Math.max(latest.downloadMbps, latest.uploadMbps) / 50) * 50)
    : 100;

  let contextText = '';
  if (hasBoth) contextText = 'baseline → via vpn';
  else if (latest) contextText = `tested ${latest.viaVpn ? 'via vpn' : 'without vpn'} — run again ${latest.viaVpn ? 'after disconnecting' : 'while connected'} to compare`;

  return (
    <div className="speed-section">
      <div className="section-header">
        <span className="section-label">// speedtest</span>
        <button className="btn-ghost" onClick={run} disabled={running}>
          {running ? <><Spinner /> testing</> : '▶ run'}
        </button>
      </div>

      {phase === 'testing' && (
        <div className="speed-testing">
          <div className="speed-testing-head">
            <Spinner className="spinner-lg" />
            <span>measuring throughput…</span>
          </div>
          <div className="speed-testing-sub">takes about 15–30 seconds</div>
          <div className="speed-progress-bar">
            <div className="speed-progress-fill" />
          </div>
        </div>
      )}

      {phase !== 'testing' && latest && (
        <div className="speed-results">
          <SpeedRow
            label="down ↓"
            value={latest.downloadMbps}
            max={maxVal}
            colorVar="--blue"
            compare={hasBoth}
            diff={dlDiff}
          />
          <SpeedRow
            label="up ↑"
            value={latest.uploadMbps}
            max={maxVal}
            colorVar="--magenta"
            compare={hasBoth}
            diff={ulDiff}
          />
        </div>
      )}

      {phase !== 'testing' && !latest && (
        <div className="empty-state">
          <span className="t-prompt">$</span> run a test to measure throughput
        </div>
      )}

      {contextText && phase !== 'testing' && (
        <div className="speed-context">{contextText}</div>
      )}
    </div>
  );
}
