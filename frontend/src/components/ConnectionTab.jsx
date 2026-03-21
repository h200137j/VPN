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
  'Bribing the internet hamsters... 🐹',
  'Putting on our invisibility cloak... 🧙',
  'Convincing packets to wear disguises...',
  'Encrypting your embarrassing searches... 🙈',
  'Negotiating with the firewall trolls... 🧌',
  'Almost invisible, hold still...',
];

const DISCONNECTING_MSGS = [
  'Telling the hamsters to take a break... 🐹',
  'Removing invisibility cloak... poof! 💨',
  'Unencrypting your dignity...',
  'Returning packets to their natural habitat...',
  'Shredding the evidence... 🔥',
  'You are now legally visible again 👀',
];

// ── Particle canvas (green = connected) ─────────────────────────────────────
function ParticleCanvas({ color = '62,207,142' }) {
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
        n.x += n.vx; n.y += n.vy;
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
            ctx.strokeStyle = `rgba(${color},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      nodes.forEach((n, i) => {
        const pulse  = 0.6 + 0.4 * Math.sin(t * 1.8 + n.pulse);
        const radius = i === 0 ? n.r * (0.85 + 0.15 * Math.sin(t * 2)) : n.r;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 4);
        grd.addColorStop(0, `rgba(${color},${pulse * 0.45})`);
        grd.addColorStop(1, `rgba(${color},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${pulse})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [color]);

  return <canvas ref={canvasRef} className="conn-particle-canvas" />;
}

// ── Connected hero ───────────────────────────────────────────────────────────
function ConnectedHero({ vpnInfo, connectedAt }) {
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="info-hero conn-hero-live">
      <ParticleCanvas color="62,207,142" />
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

// ── Network Map ─────────────────────────────────────────────────────────────
function NetworkMap({ vpnInfo }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Node x positions (matching the DOM nodes at 14%, 50%, 86%)
    const y = H / 2;
    const nodes = [
      { x: W * 0.14 },
      { x: W * 0.50 },
      { x: W * 0.86 },
    ];
    const NODE_R = 28;
    const COLORS = ['91,141,238', '62,207,142', '124,106,247'];

    const packets = [
      // outbound (left → right), travel slightly above center
      { seg: 0, t: 0.0,  speed:  0.007, size: 3,   color: '62,207,142',  dir: 1, dy: -4 },
      { seg: 0, t: 0.4,  speed:  0.005, size: 2,   color: '91,141,238',  dir: 1, dy: -4 },
      { seg: 0, t: 0.75, speed:  0.008, size: 2.5, color: '62,207,142',  dir: 1, dy: -4 },
      { seg: 1, t: 0.2,  speed:  0.006, size: 3,   color: '124,106,247', dir: 1, dy: -4 },
      { seg: 1, t: 0.6,  speed:  0.005, size: 2,   color: '62,207,142',  dir: 1, dy: -4 },
      { seg: 1, t: 0.9,  speed:  0.007, size: 2.5, color: '124,106,247', dir: 1, dy: -4 },
      // inbound (right → left), travel slightly below center
      { seg: 0, t: 0.6,  speed: -0.006, size: 2.5, color: '91,141,238',  dir: -1, dy: 4 },
      { seg: 0, t: 0.2,  speed: -0.005, size: 2,   color: '62,207,142',  dir: -1, dy: 4 },
      { seg: 1, t: 0.8,  speed: -0.007, size: 3,   color: '124,106,247', dir: -1, dy: 4 },
      { seg: 1, t: 0.35, speed: -0.005, size: 2,   color: '62,207,142',  dir: -1, dy: 4 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw edges — two lanes per segment
      for (let i = 0; i < 2; i++) {
        const ax = nodes[i].x + NODE_R;
        const bx = nodes[i + 1].x - NODE_R;
        // outbound lane
        ctx.beginPath();
        ctx.setLineDash([5, 7]);
        ctx.moveTo(ax, y - 4);
        ctx.lineTo(bx, y - 4);
        ctx.strokeStyle = `rgba(${COLORS[i]},0.18)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // inbound lane
        ctx.beginPath();
        ctx.moveTo(ax, y + 4);
        ctx.lineTo(bx, y + 4);
        ctx.strokeStyle = `rgba(${COLORS[i]},0.18)`;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw packets
      packets.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) p.t = 0;
        if (p.t < 0) p.t = 1;
        const ax = nodes[p.seg].x + NODE_R;
        const bx = nodes[p.seg + 1].x - NODE_R;
        const x  = ax + (bx - ax) * p.t;
        const py = y + p.dy;

        // trail (always points in travel direction)
        const trailLen = 18;
        const tx0 = p.speed > 0 ? x - trailLen : x + trailLen;
        const trail = ctx.createLinearGradient(tx0, py, x, py);
        trail.addColorStop(0, `rgba(${p.color},0)`);
        trail.addColorStop(1, `rgba(${p.color},0.35)`);
        ctx.beginPath();
        ctx.moveTo(tx0, py);
        ctx.lineTo(x, py);
        ctx.strokeStyle = trail;
        ctx.lineWidth = p.size;
        ctx.stroke();

        // glow
        const grd = ctx.createRadialGradient(x, py, 0, x, py, p.size * 4);
        grd.addColorStop(0, `rgba(${p.color},0.9)`);
        grd.addColorStop(1, `rgba(${p.color},0)`);
        ctx.beginPath();
        ctx.arc(x, py, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // core dot
        ctx.beginPath();
        ctx.arc(x, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},1)`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const serverLabel = vpnInfo.serverIp || 'VPN Server';
  const publicLabel = vpnInfo.publicIp  || 'Public IP';

  return (
    <div className="netmap-wrap">
      <div className="netmap-title">Network Path</div>
      <div className="netmap-stage">
        <canvas ref={canvasRef} className="netmap-canvas" />
        {/* DOM nodes overlaid */}
        <div className="netmap-nodes">
          <div className="netmap-node" style={{ '--nc': '#5b8dee' }}>
            <div className="netmap-node-circle">💻</div>
            <div className="netmap-node-label">You</div>
            <div className="netmap-node-sub">Device</div>
          </div>
          <div className="netmap-node" style={{ '--nc': '#3ecf8e' }}>
            <div className="netmap-node-circle">🛡️</div>
            <div className="netmap-node-label">VPN</div>
            <div className="netmap-node-sub">{serverLabel.length > 18 ? serverLabel.slice(0,17)+'…' : serverLabel}</div>
          </div>
          <div className="netmap-node" style={{ '--nc': '#7c6af7' }}>
            <div className="netmap-node-circle">🌐</div>
            <div className="netmap-node-label">Internet</div>
            <div className="netmap-node-sub">{publicLabel.length > 18 ? publicLabel.slice(0,17)+'…' : publicLabel}</div>
          </div>
        </div>
        {/* Lock badges on the lines */}
        <div className="netmap-locks">
          <div className="netmap-lock">🔒</div>
          <div className="netmap-lock">🔒</div>
        </div>
      </div>
    </div>
  );
}


function TransitionScreen({ mode }) {
  const isDisconnecting = mode === 'disconnecting';
  const msgs  = isDisconnecting ? DISCONNECTING_MSGS : CONNECTING_MSGS;
  const label = mode === 'reconnecting' ? 'Reconnecting' : isDisconnecting ? 'Disconnecting' : 'Connecting';
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 1000);
    return () => clearInterval(t);
  }, [msgs.length]);

  return (
    <div className={`conn-waiting${isDisconnecting ? ' conn-waiting-disc' : ''}`}>
      <div className="conn-orbit-wrap">
        <div className={`conn-orbit o1${isDisconnecting ? ' disc' : ''}`} />
        <div className={`conn-orbit o2${isDisconnecting ? ' disc' : ''}`} />
        <div className={`conn-orbit o3${isDisconnecting ? ' disc' : ''}`} />
        <div className="conn-dot-track t1">
          <div className={`conn-dot-orb${isDisconnecting ? ' orb-disc' : ''}`} />
        </div>
        <div className="conn-dot-track t2">
          <div className={`conn-dot-orb${isDisconnecting ? ' orb-disc2' : ' orb2'}`} />
        </div>
        <div className={`conn-shield-center${isDisconnecting ? ' disc' : ''}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"/>
          </svg>
        </div>
      </div>
      <div className="conn-waiting-label">{label}</div>
      <div className="conn-waiting-msg" key={msgIdx}>{msgs[msgIdx]}</div>
      <div className="conn-scan-bar">
        <div className={`conn-scan-fill${isDisconnecting ? ' disc' : ''}`} />
      </div>
    </div>
  );
}

// ── Log box ──────────────────────────────────────────────────────────────────
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

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function ConnectionTab({ vpn, disconnecting }) {
  const isConnected    = vpn.status === 'connected' && !disconnecting;
  const isConnecting   = vpn.status === 'connecting' || vpn.status === 'reconnecting';
  const isDisconnected = vpn.status === 'disconnected' && !disconnecting;

  return (
    <div className="tab-content">
      {disconnecting                && <TransitionScreen mode="disconnecting" />}
      {!disconnecting && isConnecting && <TransitionScreen mode={vpn.status} />}
      {isConnected                  && <ConnectedHero vpnInfo={vpn.vpnInfo} connectedAt={vpn.connectedAt} />}
      {isDisconnected               && (
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

      {isConnected && <NetworkMap vpnInfo={vpn.vpnInfo} />}

      <LogBox logs={vpn.logs} onClear={() => vpn.setLogs([])} />
    </div>
  );
}
