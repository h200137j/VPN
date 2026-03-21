import { useState, useEffect, useRef } from 'react';

// Animates a number from 0 to target over ~800ms
function useCountUp(target, running) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) { setDisplay(0); return; }
    const start = performance.now();
    const duration = 900;
    const from = 0;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(parseFloat((from + (target - from) * eased).toFixed(1)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

function SpeedGauge({ value, max, color }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const circumference = 2 * Math.PI * 28;
  const dash = pct * circumference;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="speed-gauge-svg">
      {/* Track */}
      <circle cx="36" cy="36" r="28" fill="none" stroke="var(--border)" strokeWidth="5" />
      {/* Progress */}
      <circle
        cx="36" cy="36" r="28"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        strokeDashoffset="0"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

function PulseRing() {
  return (
    <div className="speed-pulse-wrap">
      <div className="speed-pulse-ring r1" />
      <div className="speed-pulse-ring r2" />
      <div className="speed-pulse-ring r3" />
      <div className="speed-pulse-icon">⚡</div>
    </div>
  );
}

function SpeedBar({ label, icon, value, max, color, compare, diff }) {
  const animated = useCountUp(value, false);

  return (
    <div className="speed-tile speed-tile-animated">
      <div className="speed-tile-top">
        <div className="speed-gauge-wrap">
          <SpeedGauge value={animated} max={max} color={color} />
          <div className="speed-gauge-center">
            <span className="speed-gauge-val">{animated.toFixed(1)}</span>
            <span className="speed-gauge-unit">Mbps</span>
          </div>
        </div>
        <div className="speed-tile-info">
          <div className="speed-tile-label">{icon} {label}</div>
          {compare && diff !== null && (
            <div className={`speed-tile-compare ${diff >= 0 ? 'cmp-up' : 'cmp-down'}`}>
              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} Mbps vs no VPN
            </div>
          )}
        </div>
      </div>
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
        vpn.appendLog('Speed test error: ' + r.error, 'error');
        setPhase('idle');
      } else {
        const result = { ...r, viaVpn };
        if (viaVpn) setAfter(result); else setBefore(result);
        vpn.appendLog(
          `Speed test (${viaVpn ? 'through VPN' : 'no VPN'}): ↓ ${r.downloadMbps} Mbps  ↑ ${r.uploadMbps} Mbps`,
          'ok'
        );
        setPhase('done');
      }
    } catch (e) {
      vpn.appendLog('Speed test failed: ' + e, 'error');
      setPhase('idle');
    }
    setRunning(false);
  };

  const latest   = after || before;
  const hasBoth  = before && after;
  const dlDiff   = hasBoth ? after.downloadMbps - before.downloadMbps : null;
  const ulDiff   = hasBoth ? after.uploadMbps   - before.uploadMbps   : null;

  // Determine a reasonable max for the gauge (round up to nearest 50)
  const maxVal = latest
    ? Math.max(50, Math.ceil(Math.max(latest.downloadMbps, latest.uploadMbps) / 50) * 50)
    : 100;

  let contextText = '';
  if (hasBoth) contextText = 'Comparison: without VPN → through VPN';
  else if (latest) contextText = `Tested ${latest.viaVpn ? 'through VPN' : 'without VPN'} · Run again ${latest.viaVpn ? 'after disconnecting' : 'after connecting'} to compare`;

  return (
    <div className="speed-section">
      <div className="section-header">
        <span className="section-label">Speed Test</span>
        <button className="btn-speedtest" onClick={run} disabled={running}>
          {running ? (
            <span className="btn-speedtest-inner">
              <span className="speed-spinner" /> Testing...
            </span>
          ) : (
            <span className="btn-speedtest-inner">▶ Run Test</span>
          )}
        </button>
      </div>

      {phase === 'testing' && (
        <div className="speed-testing-state">
          <PulseRing />
          <div className="speed-testing-label">Measuring your connection...</div>
          <div className="speed-testing-sub">This takes about 15–30 seconds</div>
          <div className="speed-progress-bar">
            <div className="speed-progress-fill" />
          </div>
        </div>
      )}

      {phase !== 'testing' && latest && (
        <div className="speed-results speed-results-animated">
          <SpeedBar
            label="Download" icon="⬇"
            value={latest.downloadMbps}
            max={maxVal}
            color="var(--accent)"
            compare={hasBoth}
            diff={dlDiff}
          />
          <SpeedBar
            label="Upload" icon="⬆"
            value={latest.uploadMbps}
            max={maxVal}
            color="var(--accent3)"
            compare={hasBoth}
            diff={ulDiff}
          />
        </div>
      )}

      {phase !== 'testing' && !latest && (
        <div className="speed-idle-state">
          <div className="speed-idle-icon">📡</div>
          <div className="speed-idle-text">Run a test to measure your connection speed</div>
        </div>
      )}

      {contextText && phase !== 'testing' && (
        <div className="speed-context">{contextText}</div>
      )}
    </div>
  );
}
