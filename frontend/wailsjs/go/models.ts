export namespace main {
	
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

