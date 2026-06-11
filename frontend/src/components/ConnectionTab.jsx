import { useReducer, useEffect, useRef, useState } from 'react';
import Spinner from './Spinner';

function formatUptime(startMs) {
  if (!startMs) return '00:00';
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const KV = [
  { label: 'public_ip', key: 'publicIp',  stat: false },
  { label: 'server',    key: 'serverIp',  stat: false },
  { label: 'iface',     key: 'interface', stat: false },
  { label: 'cipher',    key: 'cipher',    stat: false },
  { label: 'rx',        key: 'rxHuman',   stat: true  },
  { label: 'tx',        key: 'txHuman',   stat: true  },
];

const CONNECT_PHASES = [
  'resolving remote host',
  'opening udp socket',
  'tls handshake',
  'verifying server certificate',
  'negotiating data channel keys',
  'pushing routes',
  'bringing up tun0',
];

const RECONNECT_PHASES = [
  'link dropped — restarting',
  'resolving remote host',
  'tls handshake',
  'negotiating data channel keys',
  'pushing routes',
  'bringing up tun0',
];

const DISCONNECT_PHASES = [
  'sending SIGTERM to openvpn',
  'closing tls session',
  'tearing down routes',
  'releasing tun0',
  'restoring dns',
  'exited cleanly (code 0)',
];

// ── Particle mesh behind the connected hero ─────────────────────────────────
function ParticleCanvas({ color = '158,206,106' }) {
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

    const NODE_COUNT = 24;
    const LINK_DIST  = 90;
    const SPEED      = 0.3;

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r:  1 + Math.random() * 1.6,
      pulse: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      nodes.forEach(n => {
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
            const alpha = (1 - dist / LINK_DIST) * 0.22;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${color},${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        const pulse = 0.35 + 0.3 * Math.sin(t * 1.6 + n.pulse);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${pulse})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [color]);

  return <canvas ref={canvasRef} className="hero-canvas" />;
}

// ── Connected hero ───────────────────────────────────────────────────────────
function ConnectedHero({ vpnInfo, connectedAt }) {
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hero">
      <ParticleCanvas />
      <div className="hero-content">
        <div className="hero-tag">
          <span className="hero-tag-dot" />
          {vpnInfo.interface || 'tun0'} up · encrypted
        </div>
        <div className="hero-ip">
          {vpnInfo.vpnIp || '—'}
          <span className="cursor-block" />
        </div>
        <div className="hero-sub">assigned vpn address</div>
        <div className="hero-uptime">up {formatUptime(connectedAt)}</div>
      </div>
    </div>
  );
}

// ── Boot sequence (connect / reconnect / disconnect) ─────────────────────────
function TransitionScreen({ mode }) {
  const isDisc  = mode === 'disconnecting';
  const phases  = isDisc ? DISCONNECT_PHASES
                : mode === 'reconnecting' ? RECONNECT_PHASES
                : CONNECT_PHASES;
  const verb    = isDisc ? 'disconnect' : mode === 'reconnecting' ? 'reconnect' : 'connect';
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const ms = isDisc ? 820 : 950;
    const t  = setInterval(() => {
      setStep(s => (s < phases.length - 1 ? s + 1 : s));
    }, ms);
    return () => clearInterval(t);
  }, [mode]);

  return (
    <div className={`boot${isDisc ? ' boot-disc' : ''}`}>
      <div className="boot-cmd">
        <span className="t-prompt">$</span> govpn {verb}
      </div>
      <div className="boot-lines">
        {phases.slice(0, step + 1).map((p, i) => (
          <div className={`boot-line${i < step ? ' done' : ' current'}`} key={p}>
            <span className="boot-mark">
              {i < step ? '✓' : <Spinner />}
            </span>
            <span>{p}</span>
          </div>
        ))}
      </div>
      <div className="boot-scan">
        <div className="boot-scan-fill" />
      </div>
    </div>
  );
}

// ── Log box ──────────────────────────────────────────────────────────────────
function logTime(id) {
  const d = new Date(Math.floor(id));
  return d.toTimeString().slice(0, 8);
}

function LogBox({ logs, onClear }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="log-wrap">
      <div className="section-header">
        <span className="section-label">// log</span>
        <button className="btn-ghost" onClick={onClear}>clear</button>
      </div>
      <div className="log-box" ref={boxRef}>
        {logs.length === 0
          ? <p className="log-line info"><span className="log-time">--:--:--</span>— no output —</p>
          : logs.map(l => (
              <p key={l.id} className={`log-line ${l.type}`}>
                <span className="log-time">{logTime(l.id)}</span>
                {l.msg}
              </p>
            ))
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
      {disconnecting                  && <TransitionScreen mode="disconnecting" />}
      {!disconnecting && isConnecting && <TransitionScreen mode={vpn.status} />}
      {isConnected                    && <ConnectedHero vpnInfo={vpn.vpnInfo} connectedAt={vpn.connectedAt} />}
      {isDisconnected                 && (
        <div className="term-empty">
          <div className="term-line"><span className="t-prompt">$</span> govpn status</div>
          <div className="term-line t-err">tun0: no such device</div>
          <div className="term-line t-dim">not connected — select a profile and run connect</div>
          <div className="term-line"><span className="t-prompt">$</span> <span className="cursor-block" /></div>
        </div>
      )}

      {isConnected && (
        <div className="kv-grid">
          {KV.map(({ label, key, stat }) => (
            <div className="kv" key={label}>
              <span className="kv-k">{label}</span>
              <span className="kv-v">
                {(stat ? vpn.trafficStats[key] : vpn.vpnInfo[key]) || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      <LogBox logs={vpn.logs} onClear={() => vpn.setLogs([])} />
    </div>
  );
}
