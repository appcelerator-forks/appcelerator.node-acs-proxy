# Node.ACS Local Developer Proxy

This is a Node.ACS module that will allow local Node.ACS apps to register with a remote routing proxy in production.  Incoming requests to the public Node.ACS app (this app) will be routed back to the local (or could be behind a firewall for example) Node.ACS application via web sockets.

Supports registering multiple applications with multiple developers.

Requires a Appcelerator network ID to login.

## Usage

To use this in a Node.ACS application, install the following node module:

	$ npm install node-acs-proxy --save

Then, add it to your application after calling `app.listen`:

```javascript
var express = require('express'),
	app = express(),
	server = app.listen(process.env.PORT || 8081),
	proxy = require('node-acs-proxy')(app,server);
```

When you startup your application locally (either using node or `acs run`), you will get a prompt to login to your Appcelerator account:

```bash
[REMOTE] Login required to connect to remote server
username your@login.com
password
[REMOTE] Connecting to remote server 3a8fa4eec99ad64084a47dd94e5142321cddd9ec.cloudapp.appcelerator.com
[REMOTE] App will be available at https://3a8fa4eec99ad64084a47dd94e5142321cddd9ec.cloudapp.appcelerator.com/1029
```

You can now use this URL to route to your local server on your development machine. Just append your URI path to the provided URL. For example, if you are trying to load the static file `/js/jquery.js`, using the URL example above, the full URL would be `https://3a8fa4eec99ad64084a47dd94e5142321cddd9ec.cloudapp.appcelerator.com/1029/js/jquery.js`.

Subsequent logins will cache your credentials in the OSX keychain.

## Notes

This module is safe to leave in your production code. If your application is deployed in Node.ACS production, it will not be loaded.

This module currently only works with expressjs.

This module only works on OSX machines (for now).

## License

Licensed under the Apache Public License, v2. 
