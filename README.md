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

This module is safe to leave in your production code. If your application is deployed in Node.ACS production, it will not be loaded.

This module currently only works with expressjs.

## License

Licensed under the Apache Public License, v2. 
