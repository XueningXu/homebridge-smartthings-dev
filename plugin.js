"use strict";

var smartthingsActions = require('./lib/smartthingsActions.js');
var EventEmitter = require('events').EventEmitter;
var createError = require('http-errors');
var os = require("os");
var path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const packageConfig = require('./package.json');
const httpsServer = require('./lib/smartthings/httpsServer.js');
// const router_connector_smartthings = require('./lib/smartthings/smartthings-connector.js');
const router_oauth2_ST = require('./lib/smartthings/oauth/oauth2.js');
const db = require('./lib/smartthings/db/db.js');
const config = require('./lib/smartthings/config.js');
let Service, Characteristic;


var options = {};
var smartthingsService;
const app = express();

// Put body-parser always after express object and before every routes in main server file (route)
// Other wise always will get undefined since router call first and body parsed later.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// set view engine
app.set('views', path.join(__dirname, 'lib/smartthings/views'));
app.set('view engine', 'pug');



module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-smartthings-dev", "SmartThings", smartthingsHome);
};

function smartthingsHome(log, config, api) {
  this.log = log;
  this.eventBus = new EventEmitter();
  this.config = config;
  this.pin = config['pin'] || "031-45-154";
  // this.username = config['username'] || false;
  // this.password = config['password'] || false;
  this.filter = config['filter'];
  this.beta = config['beta'] || false;
  this.events = config['routines'] || false;
  // this.combine = config['combine'] || false;
  this.oldParser = config['oldParser'] || false;
  this.refresh = config['refresh'] || 60 * 15; // Value in seconds, default every 15 minute's
  this.speakers = config['speakers'] || false; // Array of speaker devices
  // this.inputs = config['inputs'] || false; // Array of input devices
  // this.channel = config['channel'] || false; // Array of input devices
  this.blind = config['blind'] || false; // Use range controller for Blinds
  this.deviceListHandling = config['deviceListHandling'] || []; // Use ea
  this.deviceList = config['deviceList'] || []; // Use ea
  this.door = config['door'] || false; // Use mode controller for Garage Doors
  this.name = config['name'] || "homebridgeSmartThings";
  /*
  var mqttKeepalive = config['keepalive'] || 20; // MQTT Connection Keepalive
  if( mqttKeepalive < 60 )
    {
      this.keepalive = mqttKeepalive * 60;
    } else {
      this.keepalive = mqttKeepalive;
    }
  */
  // Enable config based DEBUG logging enable
  this.debug = config['debug'] || false;
  if (this.debug) {
    let debugEnable = require('debug');
    let namespaces = debugEnable.disable();

    // this.log("DEBUG-1", namespaces);
    if (namespaces) {
      namespaces = namespaces + ',smartthings*';
    } else {
      namespaces = 'smartthings*';
    }
    // this.log("DEBUG-2", namespaces);
    debugEnable.enable(namespaces);
  }

  if (!this.username || !this.password) {
    this.log.error("Missing username and password");
  }

  if (this.oldParser) {
    this.log.error("ERROR: oldParser was deprecated with version 0.5.0, defaulting to new Parser.");
  }

  if (api) {
    this.api = api;
    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  this.log.info(
    '%s v%s, node %s, homebridge v%s',
    packageConfig.name, packageConfig.version, process.version, api.serverVersion
  );
}

smartthingsHome.prototype = {
  accessories: function(callback) {
    // this.log("Accessories");
    var accessories = [];
    accessories.push(new smartthingsService(this.name, this.log));
    callback(accessories);
  }
};

smartthingsHome.prototype.didFinishLaunching = function() {
  var host = 'alexa.homebridge.ca';
  if (this.beta) {
    host = 'alexabeta.homebridge.ca';
  }
  options = {
    // Shared Options
    log: this.log,
    debug: this.debug,
    /*
    // MQTT Options
    username: this.username,
    password: this.password,
    servers: [{
      protocol: 'mqtt',
      host: host,
      port: 1883
    }],
    reconnectPeriod: 65000,
    keepalive: this.keepalive,      // Reduce client timeout to 10 minutes
    */
    // HAP Node Client options
    pin: this.pin,
    refresh: this.refresh,
    eventBus: this.eventBus,
    // HB Parser options
    oldParser: this.oldParser,
    // combine: this.combine,
    speakers: this.speakers,
    filter: this.filter,
    smartthingsService: smartthingsService,
    Characteristic: Characteristic,
    // inputs: this.inputs,
    // channel: this.channel,
    blind: this.blind,
    deviceListHandling: this.deviceListHandling,
    deviceList: this.deviceList,
    door: this.door,
    // Other Options
    events: this.events
  };
  
  
  // Initialize the databases
  db.open();
  
  // Create a default account for logging into MP-Mediator in development mode
  if(config.mode === 'dev') {
    db.addAccount("test@mpm.com", "test");
  }
  
  // start HTTPs server
  httpsServer.create_http_server(app);
  
  //Route
  app.get('/', (req, res) => {
    res.send('testing');
  })
  // app.use('/smartthings', router_connector_smartthings); // integration with SmartThings
  
  app.use('/smartthings/oauth2', router_oauth2_ST);
  
  
  
  // Initialize HAP Connections
  smartthingsActions.hapDiscovery(options);


  // Homebridge HAP Node Events
  // smartthingsEvent: send state update event to smartthings on receiving the event
  
  this.eventBus.on('hapEvent', smartthingsActions.smartthingsEvent.bind(this));

  
};



function smartthingsService(name, log) {
  this.name = name;
  this.log = log;
}

smartthingsService.prototype = {
  getServices: function() {
    // this.log("getServices", this.name);
    // Information Service
    var informationService = new Service.AccessoryInformation();
    var hostname = os.hostname();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "homebridge-smartthings-dev")
      .setCharacteristic(Characteristic.SerialNumber, hostname)
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version);
    // Thermostat Service

    smartthingsService = new Service.ContactSensor(this.name);

    return [informationService, smartthingsService];
  }
};
