export default function Header({ status, disconnecting }) {
  const labels = {
    connecting:   'connecting',
    connected:    'connected',
    disconnected: 'offline',
    reconnecting: 'reconnecting',
  };
  const label = disconnecting ? 'disconnecting' : (labels[status] || status);
  const cls   = disconnecting ? 'connecting'
              : status === 'reconnecting' ? 'connecting'
              : status;

  return (
    <div className="header">
      <div className="wordmark">
        <span className="wm-prompt">❯</span>
        <span className="wm-name">govpn</span>
        <span className="wm-cursor" />
      </div>
      <div className={`status-chip ${cls}`}>
        <span className="status-dot" />
        <span>{label}</span>
      </div>
    </div>
  );
}
