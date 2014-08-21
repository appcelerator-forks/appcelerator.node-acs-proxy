/**
 * example app
 */
var express = require('express'),
	app = express(),
	server = app.listen(process.env.PORT || 8081),
	proxy = require('./lib/index')(app,server);

app.get('/',function(req, resp){
	resp.send('OHAI');
});