export namespace main {
	
	export class DatabaseConfig {
	    host: string;
	    port: number;
	    username: string;
	    encryptedPassword: string;
	    dbname: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.encryptedPassword = source["encryptedPassword"];
	        this.dbname = source["dbname"];
	    }
	}
	export class AppConfig {
	    database: DatabaseConfig;
	    webPort: number;
	    jwtSecret: string;
	    lastInitTime: string;
	    lastUpgradeTime: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = this.convertValues(source["database"], DatabaseConfig);
	        this.webPort = source["webPort"];
	        this.jwtSecret = source["jwtSecret"];
	        this.lastInitTime = source["lastInitTime"];
	        this.lastUpgradeTime = source["lastUpgradeTime"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DatabaseStatus {
	    status: string;
	    migrationCount: number;
	    lastInitTime: string;
	    lastUpgradeTime: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.migrationCount = source["migrationCount"];
	        this.lastInitTime = source["lastInitTime"];
	        this.lastUpgradeTime = source["lastUpgradeTime"];
	        this.message = source["message"];
	    }
	}

}

