var WebSocket = require('ws'),
	prompt = require('prompt'),
  	events = require('events'),
  	util = require('util'),
  	debug = require('debug')('server'),
  	colors = require('colors'),
  	ip = require('ip'),
  	url = require('url'),
  	keychain = require('keychain'),
  	request = require('request'),
	fs = require('fs'),
	path = require('path'),
	crypto = require('crypto'),
	acsConfig = path.join(process.env.HOME, '.acs');

const DEFAULT_HOST = '10d0c4978428703fb4525f0e9e61048bd9e2c4ad.cloudapp.appcelerator.com';

function msg() {
	var args = Array.prototype.slice.call(arguments, 0);
	console.log('[REMOTE]'.magenta, args.join(' '));
}

function Server(app, server, config) {
	if (!isRunningLocally()) {
		debug('running in production, skipping');
		return;
	}
	config = config || {};
	var uri = config.url || process.env.NODEACS_REMOTE || 'wss://'+DEFAULT_HOST;
	var username = config.username;	
	var password = config.password;
	var addr = server.address();
	// create a hash of our current working directory as the name of the application.
	// while it's not the "real name" it's good enough to provide a unique identifier that
	// can identify different applications on the same machine
	var appname = crypto.createHash('sha1').update(process.cwd()).digest('hex');
	// if we have specified a URL use that as the address vs. our real IP address
	var address = config.address || process.env.URL || ip.address();

	if (!username) {
		// check for .acs and attempt to read in our username if we have it saved
		if (fs.existsSync(acsConfig)) {
			try {
				var c = JSON.parse(fs.readFileSync(acsConfig).toString());
				c && c.username && (username=c.username);
				msg('Using logged in username:',username.cyan);
			}
			catch (E){
				// if we fail reading data. this is OK, just force login
			}
		}
	}

	var Self = function(){};

	util.inherits(Self, events.EventEmitter);
		
	var self = new Self();

	self.app = app;
	self.server = server;

	prompt.message = '';
  	prompt.delimiter = '';

  	// keychain only works for OSX
  	var isOSX = (process.platform==='darwin');

	if (!username || !password) {
		if (username) {
			for (var c=0;c<process.argv.length;c++) {
				if (process.argv[c]==='--logout') {
					username = password = null;
					fs.existsSync(acsConfig) && fs.unlinkSync(acsConfig);
					if (isOSX) {
						keychain.deletePassword({service:'node-acs-proxy',account:username}, function(){
							msg('Your password has been removed from the keychain.');
							process.exit(0);
						});
					}
					else {
						process.exit(0);
					}
				}
				if (process.argv[c]==='--login') {
					username = password = null;
					continue;
				}
			}
			// attempt to read the password from the OSX keychain
			if (isOSX) {
				keychain.getPassword({service:'node-acs-proxy',account:username}, function(err,pass){
					if (pass) {
						password = pass;
						msg('Using password from keychain. Clear this with --logout from command-line. Force a new login with --login.');
						return start.bind(self)();
					}
					else {
						// something failed, that's OK, just prompt for it
						remoteAuth();
					}
				});
			}
			else {
				remoteAuth();
			}
		}
		else {
			remoteAuth();
		}

		function remoteAuth() {
			msg('Login required to connect to remote server');
			prompt.start();

			var fields = [];
			if (!username) {
				fields.push({
					name:'username',
					required: true
				});
			}
			if (!password) {
				fields.push({
					name:'password',
					required: true,
					hidden: true
				});
			}

			prompt.get(fields, function (err, result) {
			    username = result.username || username;
			    password = result.password || password;
			    start.bind(self)();
			});
		}
	}
	else {
		start.bind(self)();
	}

	process.on('exit', stop);
	process.on('SIGINT', stop);

	function stop() {
		debug('stop called');
		self.send('logout');
		process.exit(0);
	}

	self.connected = false;
	self.reconnectTimer = null;
	self.reconnectRetry = 500;

	function reconnect() {
		if (!self.connected) {
			if (self.reconnectTimer) {
				clearTimeout(self.reconnectTimer);
			}
			msg('attempt to re-connect to server');
			self.reconnectTimer = setTimeout(start.bind(self), self.reconnectRetry);
			self.reconnectRetry += 250; // get slower each time
		}
	}

	function start() {
		var uriparts = url.parse(uri);
		msg('Connecting to remote server',uriparts.host.cyan);
		this.ws = new WebSocket(uri);

		this.ws.on('error',function(e){
			msg('ERROR',String(e),uri);
			reconnect();
		});

		// called when socket is connected
		this.ws.on('open', function() {
			debug('connected to server',uri);
			this.connected = true;
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}
			this.reconnectRetry = 500; // once connected, reset
			this.send('login',{
				username: username, 
				password: password,
				address: address,
				appname: appname,
				user: process.env.USER || process.env.LOGNAME
			});
		}.bind(this));

		// called when socket is closed
		this.ws.on('close', function(){
			msg('server closed socket');
			this.connected = false;
			reconnect();
		}.bind(this));

		this.ws.on('message', function(data, flags) {
			if (data && typeof(data)==='string') {
				try {
					data = JSON.parse(data);
					if (data.event) {
						this.emit(data.event, data.payload);
					}
				}
				catch (E) {
					//ignore
					debug('message receive error',E)
				}
			}
		}.bind(this));
	}

	self.send = function(name, payload) {
		if (this.ws) {
			debug('send:'+name);
			var evt = {
				event: name,
				payload: payload || {},
				key: self.key
			};
			try {
				this.ws.send(JSON.stringify(evt));
			}
			catch (E) {
				console.log(E,E.message);
			}
		}
	};

	// called when we have an invalid login
	self.on('error', function(data){
		if (data && data.message) {
			return msg('Error:',data.message.red);
		}
		return msg('Error:',data);
	});

	// called when the server is shutting down
	self.on('shutdown', function(){
		try { self.ws.close(); self.ws = null; } catch (E) { }
		msg('server is shutting down');
		self.connected = false;
		reconnect();
	});

	// called once we have a valid login
	self.on('connected', function(data){
		keychain.setPassword({service:'node-acs-proxy',account:username,password:password},function(err){
			debug('saved to keychain');
		});
		self.key = data.key;
		self.url = data.url;
		debug('Connected',data);
		msg('App will be available at '+data.url.cyan);
	});

	// called on an incoming (external) request
	self.on('route', function(data){
		debug('route called',data);

		var url = 'http://'+addr.address+':'+addr.port+'/'+data.path;
		var opts = {
			method: data.method,
			headers: data.headers,
			url: url,
			gzip: true,
			encoding: null
		};

		// to be safe and accurate, just do a local request to our webserver
		request(opts, function(err, resp, body) {
			var result = {
				status: resp && resp.statusCode,
				error: err,
				headers: resp && resp.headers,
				body: body && body.toString('base64'),
				uid: data.uid
			};
			self.send('response',result);
		});

	});

	return self;
}

/**
 * this will return true if not running inside of Node.ACS environment
 */
function isRunningLocally() {
	return !process.env.appid && 
			!process.env.serverId;
}

process.on('uncaughtException', function(err) {
    console.log(err);
});


exports = module.exports = Server;

