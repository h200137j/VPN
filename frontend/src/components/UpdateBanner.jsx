import { useState, useEffect } from 'react';

export default function UpdateBanner({ vpn }) {
  const [info, setInfo]         = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    vpn.CheckForUpdate().then(u => {
      if (u.hasUpdate) setInfo(u);
    }).catch(() => {});
  }, []);

  if (!info || dismissed) return null;

  return (
    <div className="update-banner">
      <span className="update-banner-text">
        🚀 <strong>{info.latestTag}</strong> is available
      </span>
      <a
        className="update-banner-link"
        href="#"
        onClick={e => { e.preventDefault(); vpn.BrowserOpenURL(info.releaseUrl); }}
      >
        Download
      </a>
      <button className="update-banner-dismiss" onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
