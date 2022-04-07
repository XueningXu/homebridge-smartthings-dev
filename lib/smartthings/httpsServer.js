var http = require('http');
var debug = require('debug')('smartthings:httpsServer');
const port = 2022;

module.exports = {
  create_http_server: create_http_server
};


//===========================================================
// Create a HTTP server
//===========================================================

function create_http_server(app) {
  app.set('port', port);
  var httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    debug("HTTP Server listening on: ", port);
  });
}
