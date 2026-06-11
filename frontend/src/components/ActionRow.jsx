import Spinner from './Spinner';

export default function ActionRow({ status, activeProfileId, profileName, onConnect, onDisconnect, appendLog, disconnecting }) {
  const isActive = status === 'connected' || status === 'connecting' || status === 'reconnecting';
  const busy     = status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    if (!activeProfileId) { appendLog('no profile selected — pick one first', 'warn'); return; }
    onConnect();
  };

  if (disconnecting) {
    return (
      <div className="action-row">
        <button className="btn-cmd btn-cmd-busy" disabled>
          <Spinner /> <span>disconnecting</span>
        </button>
      </div>
    );
  }

  return (
    <div className="action-row">
      {!isActive ? (
        <button className="btn-cmd btn-cmd-connect" onClick={handleConnect} disabled={!activeProfileId}>
          <span className="cmd-prompt">$</span>
          <span>govpn connect</span>
          {profileName && <span className="cmd-arg">--profile {profileName}</span>}
        </button>
      ) : busy ? (
        <button className="btn-cmd btn-cmd-cancel" onClick={onDisconnect}>
          <span className="cmd-prompt">^C</span>
          <span>cancel</span>
        </button>
      ) : (
        <button className="btn-cmd btn-cmd-disconnect" onClick={onDisconnect}>
          <span className="cmd-prompt">$</span>
          <span>govpn disconnect</span>
        </button>
      )}
    </div>
  );
}
