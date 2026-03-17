export namespace main {
	
	export class AuditEntry {
	    id: string;
	    profileName: string;
	    connectedAt: string;
	    duration: string;
	    vpnIp: string;
	    serverIp: string;
	
	    static createFrom(source: any = {}) {
	        return new AuditEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profileName = source["profileName"];
	        this.connectedAt = source["connectedAt"];
	        this.duration = source["duration"];
	        this.vpnIp = source["vpnIp"];
	        this.serverIp = source["serverIp"];
	    }
	}
	export class CertInfo {
	    subject: string;
	    issuer: string;
	    expiresAt: string;
	    daysLeft: number;
	    isExpired: boolean;
	    isWarning: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CertInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subject = source["subject"];
	        this.issuer = source["issuer"];
	        this.expiresAt = source["expiresAt"];
	        this.daysLeft = source["daysLeft"];
	        this.isExpired = source["isExpired"];
	        this.isWarning = source["isWarning"];
	    }
	}
	export class PingResult {
	    host: string;
	    reachable: boolean;
	    minMs: number;
	    avgMs: number;
	    maxMs: number;
	    packetLoss: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PingResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.reachable = source["reachable"];
	        this.minMs = source["minMs"];
	        this.avgMs = source["avgMs"];
	        this.maxMs = source["maxMs"];
	        this.packetLoss = source["packetLoss"];
	        this.error = source["error"];
	    }
	}
	export class Profile {
	    id: string;
	    name: string;
	    ovpnPath: string;
	    username: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ovpnPath = source["ovpnPath"];
	        this.username = source["username"];
	        this.password = source["password"];
	    }
	}
	export class SpeedResult {
	    downloadMbps: number;
	    uploadMbps: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new SpeedResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.downloadMbps = source["downloadMbps"];
	        this.uploadMbps = source["uploadMbps"];
	        this.error = source["error"];
	    }
	}
	export class TrafficStats {
	    rxBytes: number;
	    txBytes: number;
	    rxHuman: string;
	    txHuman: string;
	    uptime: string;
	
	    static createFrom(source: any = {}) {
	        return new TrafficStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rxBytes = source["rxBytes"];
	        this.txBytes = source["txBytes"];
	        this.rxHuman = source["rxHuman"];
	        this.txHuman = source["txHuman"];
	        this.uptime = source["uptime"];
	    }
	}
	export class UpdateInfo {
	    hasUpdate: boolean;
	    latestTag: string;
	    currentTag: string;
	    releaseUrl: string;
	    releaseBody: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasUpdate = source["hasUpdate"];
	        this.latestTag = source["latestTag"];
	        this.currentTag = source["currentTag"];
	        this.releaseUrl = source["releaseUrl"];
	        this.releaseBody = source["releaseBody"];
	    }
	}
	export class VPNInfo {
	    vpnIp: string;
	    publicIp: string;
	    serverIp: string;
	    interface: string;
	    cipher: string;
	    gateway: string;
	
	    static createFrom(source: any = {}) {
	        return new VPNInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vpnIp = source["vpnIp"];
	        this.publicIp = source["publicIp"];
	        this.serverIp = source["serverIp"];
	        this.interface = source["interface"];
	        this.cipher = source["cipher"];
	        this.gateway = source["gateway"];
	    }
	}

}

