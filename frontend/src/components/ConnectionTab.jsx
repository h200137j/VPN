import { useReducer, useEffect, useRef, useState } from 'react';

function formatUptime(startMs) {
  if (!startMs) return '00:00';
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const TILES = [
  { icon: '🌐', label: 'Public IP',   key: 'publicIp',  stat: false },
  { icon: '🖥',  label: 'VPN Server',  key: 'serverIp',  stat: false },
  { icon: '🔌', label: 'Interface',   key: 'interface', stat: false },
  { icon: '🔒', label: 'Cipher',      key: 'cipher',    stat: false },
  { icon: '⬇',  label: 'Downloaded',  key: 'rxHuman',   stat: true  },
  { icon: '⬆',  label: 'Uploaded',    key: 'txHuman',   stat: true  },
];

const CONNECTING_MSGS = [
  'Establishing secure tunnel...',
  'Authenticating credentials...',
  'Negotiating encryption...',
  'Configuring routes...',
  'Almost there...',
];

function ParticleCanvas() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    const NODE_COUNT = 28;
    const LINK_DIST  = 90;
    const SPEED      = 0.35;

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r:  1.5 + Math.random() * 2,
      pulse: Math.random() * Math.PI * 2,
    }));

    nodes[0].r  = 5;
    nodes[0].x  = W * 0.5;
    nodes[0].y  = H * 0.5;
    nodes[0].vx = 0;
    nodes[0].vy = 0;

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      nodes.forEach((n, i) => {
        if (i === 0) return;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.4;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(62,207,142,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      nodes.forEach((n, i) => {
        const pulse  = 0.6 + 0.4 * Math.sin(t * 1.8 + n.pulse);
        const radius = i === 0 ? n.r * (0.85 + 0.15 * Math.sin(t * 2)) : n.r;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 4);
        grd.addColorStop(0, `rgba(62,207,142,${pulse * 0.45})`);
        grd.addColorStop(1, 'rgba(62,207,142,0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(62,207,142,${pulse})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} className="conn-particle-canvas" />;
}

function ConnectedHero({ vpnInfo, connectedAt }) {
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="info-hero conn-hero-live">
      <ParticleCanvas />
      <div className="conn-ripple r1" />
      <div className="conn-ripple r2" />
      <div className="conn-ripple r3" />
      <div className="conn-hero-content">
        <div className="conn-hero-shield">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"/>
          </svg>
        </div>
        <div className="info-hero-ip">{vpnInfo.vpnIp || '—'}</div>
        <div className="info-hero-label">VPN IP Address · Encrypted</div>
        <div className="uptime-badge">{formatUptime(connectedAt)}</div>
      </div>
    </div>
  );
}

function ConnectingScreen({ status }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const label = status === 'reconnecting' ? 'Reconnecting' : 'Connecting';

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % CONNECTING_MSGS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="conn-waiting">
      <div className="conn-orbit-wrap">
        <div className="conn-orbit o1" />
        <div className="conn-orbit o2" />
        <div className="conn-orbit o3" />
        <div className="conn-dot-track t1"><div className="conn-dot-orb" /></div>
        <div className="conn-dot-track t2"><div className="conn-dot-orb orb2" /></div>
        <div className="conn-shield-center">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"/>
          </svg>
        </div>
      </div>
      <div className="conn-waiting-label">{label}</div>
      <div className="conn-waiting-msg" key={msgIdx}>{CONNECTING_MSGS[msgIdx]}</div>
      <div className="conn-scan-bar"><div className="conn-scan-fill" /></div>
    </div>
  );
}

function LogBox({ logs, onClear }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="log-wrap">
      <div className="log-header">
        <span>Connection Log</span>
        <button className="btn-clear" onClick={onClear}>Clear</button>
      </div>
      <div className="log-box" ref={boxRef}>
        {logs.length === 0
          ? <p className="info">No log entries yet.</p>
          : logs.map(l => <p key={l.id} className={l.type}>{l.msg}</p>)
        }
      </div>
    </div>
  );
}

export default function ConnectionTab({ vpn }) {
  const isConnected    = vpn.status === 'connected';
  const isConnecting   = vpn.status === 'connecting' || vpn.status === 'reconnecting';
  const isDisconnected = vpn.status === 'disconnected';

  return (
    <div className="tab-content">
      {isConnecting  && <ConnectingScreen status={vpn.status} />}
      {isConnected   && <ConnectedHero vpnInfo={vpn.vpnInfo} connectedAt={vpn.connectedAt} />}
      {isDisconnected && (
        <div className="disconnected-hint">
          <div className="hint-icon">🛡</div>
          <div className="hint-text">Not connected</div>
          <div className="hint-sub">Select a profile and hit Connect to get started</div>
        </div>
      )}

      {isConnected && (
        <div className="info-grid">
          {TILES.map(({ icon, label, key, stat }) => (
            <div className="info-tile" key={label}>
              <div className="info-tile-icon">{icon}</div>
              <div className="info-tile-body">
                <div className="info-tile-label">{label}</div>
                <div className="info-tile-value">
                  {(stat ? vpn.trafficStats[key] : vpn.vpnInfo[key]) || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LogBox logs={vpn.logs} onClear={() => vpn.setLogs([])} />
    </div>
  );
}
