import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConnectProfile, Disconnect, LoadProfiles, ImportProfile,
  UpdateProfile, DeleteProfile, PickOvpnFile, GetTrafficStats,
  LoadAuditLog, ClearAuditLog, CheckProfileCerts,
  CheckForUpdate, CheckChangelog, GetCurrentVersion,
  PingServer, RunSpeedTest, GetSettings, SaveSettings, GetLocalIP, GetPublicIP
} from '../../wailsjs/go/main/App';
import { EventsOn, WindowSetSize, BrowserOpenURL } from '../../wailsjs/runtime/runtime';

export function useVPN() {
  const [status, setStatusState]   = useState('disconnected'); // connecting|connected|disconnected|reconnecting
  const [vpnInfo, setVpnInfo]       = useState({});
  const [logs, setLogs]             = useState([]);
  const [profiles, setProfiles]     = useState([]);
  const [certWarnings, setCertWarnings] = useState({});
  const [trafficStats, setTrafficStats] = useState({});
  const [connectedAt, setConnectedAt]   = useState(null);
  const [localIP, setLocalIP]       = useState('...');
  const [activeProfileId, setActiveProfileId] = useState(null);

  const timerRef  = useRef(null);
  const statsRef  = useRef(null);

  // ── Logging ──
  const appendLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, id: Date.now() + Math.random() }]);
  }, []);

  // ── Status ──
  const setStatus = useCallback((state) => {
    setStatusState(state);
    if (state === 'connected') {
      setConnectedAt(Date.now());
      WindowSetSize(600, 1020);
      timerRef.current = setInterval(() => {
        setConnectedAt(prev => prev); // trigger re-render for uptime
      }, 1000);
      statsRef.current = setInterval(async () => {
        try { setTrafficStats(await GetTrafficStats()); } catch(_) {}
      }, 2000);
    } else if (state === 'disconnected') {
      WindowSetSize(600, 720);
      clearInterval(timerRef.current);
      clearInterval(statsRef.current);
      setConnectedAt(null);
      setVpnInfo({});
      setTrafficStats({});
      refreshProfiles();
      refreshLocalIP();
    }
  }, []);

  // ── Profiles ──
  const refreshProfiles = useCallback(async () => {
    const list = await LoadProfiles();
    setProfiles(list || []);
    if (list && list.length > 0) {
      setActiveProfileId(prev => prev || list[0].id);
    }
    try {
      const certs = await CheckProfileCerts();
      setCertWarnings(certs || {});
    } catch(_) {}
  }, []);

  // ── Local IP ──
  const refreshLocalIP = useCallback(async () => {
    try { setLocalIP(await GetLocalIP()); } catch(_) { setLocalIP('unavailable'); }
  }, []);

  // ── Connect / Disconnect ──
  const connect = useCallback(async (profileId) => {
    setStatus('connecting');
    appendLog('Starting OpenVPN...', 'info');
    try {
      await ConnectProfile(profileId);
    } catch(e) {
      if (String(e).includes('already connected')) {
        appendLog('Detected stale connection — force disconnecting...', 'warn');
        try { await Disconnect(); } catch(_) {}
        await new Promise(r => setTimeout(r, 1500));
        try { await ConnectProfile(profileId); }
        catch(e2) { appendLog(`Error: ${e2}`, 'error'); setStatus('disconnected'); }
      } else {
        appendLog(`Error: ${e}`, 'error');
        setStatus('disconnected');
      }
    }
  }, [setStatus, appendLog]);

  const disconnect = useCallback(async () => {
    try { await Disconnect(); } catch(e) { appendLog(`Error: ${e}`, 'error'); }
  }, [appendLog]);

  // ── Events ──
  useEffect(() => {
    const unsubs = [
      EventsOn('vpn:status', setStatus),
      EventsOn('vpn:info',   (info) => setVpnInfo(prev => ({ ...prev, ...info }))),
      EventsOn('vpn:log',    (line) => {
        let type = 'info';
        if (/error|failed|fatal/i.test(line)) type = 'error';
        else if (/warn/i.test(line)) type = 'warn';
        else if (/sequence completed|connected/i.test(line)) type = 'ok';
        appendLog(line, type);
      }),
      EventsOn('vpn:reconnect', (data) => {
        appendLog(`Waiting ${data.delay}s before attempt ${data.attempt}/${data.total}...`, 'warn');
      }),
    ];
    return () => unsubs.forEach(fn => typeof fn === 'function' && fn());
  }, [setStatus, appendLog]);

  // ── Init ──
  useEffect(() => {
    refreshProfiles();
    setTimeout(refreshLocalIP, 200);
  }, []);

  return {
    status, vpnInfo, logs, setLogs, profiles, certWarnings,
    trafficStats, connectedAt, localIP, activeProfileId,
    setActiveProfileId, connect, disconnect, appendLog,
    refreshProfiles,
    // Pass-through API calls
    ImportProfile, UpdateProfile, DeleteProfile, PickOvpnFile,
    LoadAuditLog, ClearAuditLog, CheckForUpdate, CheckChangelog,
    GetCurrentVersion, PingServer, RunSpeedTest, GetSettings, SaveSettings,
    BrowserOpenURL,
  };
}
