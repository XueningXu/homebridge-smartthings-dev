var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;
var Homebridges = require('./parse/Homebridges.js').Homebridges;
var smartthingsMessages = require('./smartthingsMessages.js');
var messages = require('./parse/messages');
var debug = require('debug')('smartthingsActions');
var db = require('./smartthings/db/db.js');

var homebridge;
var hbDevices;
var deviceList_global;
var pin;
var homebridge_instance;


module.exports = {
  smartthingsDiscovery: smartthingsDiscovery,
  smartthingsEvent: smartthingsEvent,
  registerEvents: registerEvents,
  hapDiscovery: hapDiscovery
};


function hapDiscovery(options) {
  homebridge = new HAPNodeJSClient(options);
  
  pin = options.pin;
  
  if (deviceList_global === undefined) {
    deviceList_global = options.deviceList;
    debug('deviceList_global: ', deviceList_global);
  }

  homebridge.on('Ready', function() {
    smartthingsDiscovery.call(options, null, function() {
      // debug("Events", options);
      if (options.events) {
        registerEvents(messages.checkEventDeviceList.call(options, hbDevices.toEvents(undefined, deviceList_global)));
      }
    });
  });

  homebridge.on('hapEvent', function(event) {
    // debug("Event Relay - 2", event);
    options.eventBus.emit('hapEvent', event);
  });
  // debug("Event Relay - 1", homebridge);
}




function registerEvents(message) {
  debug("registerEvents", message);
  // [
  //  '{"deviceID":"XX:XX:XX:XX:XX:XX","aid":2,"iid":10}': 
  //  {endpointID: 'XXXXXX', deviceType: 'Outlet', friendlyName: 'Wemo Mini'}
  // ]
  
  var HBMessage = [];

  for (var key in message) {
    var endpoint = JSON.parse(key);
    var device = {
      "aid": endpoint.aid,
      "iid": endpoint.iid,
      "ev": true
    };
    
    var deviceType = message[key].deviceType;
    var friendlyName = message[key].friendlyName;
    
    db.insertDevice(device, deviceType, friendlyName);

    var x = {
      "deviceID": endpoint.deviceID
    };

    if (HBMessage[JSON.stringify(x)]) {
      HBMessage[JSON.stringify(x)].characteristics.push(device);
    } else {
      HBMessage[JSON.stringify(x)] = {
        "characteristics": [device]
      };
    }
  }
  for (var register in HBMessage) {
    // console.log("send", instance, HBMessage[instance]);
    var hbInstance = JSON.parse(register);
    homebridge_instance = hbInstance;
    debug("Event Register %s ->", hbInstance.deviceID, HBMessage[register]);
    homebridge.HAPeventByDeviceID(hbInstance.deviceID, JSON.stringify(HBMessage[register]), function(err, status) {
      if (!err) {
        // debug("Registered Event %s:%s ->", hbInstance.host, hbInstance.port, status);
      } else {
        debug("Error: Event Register %s:%s ->", hbInstance.deviceID, err, status);
      }
    });
  }
}



function smartthingsDiscovery(message, callback) {

  homebridge.HAPaccessories(function(endPoints) {
    debug("smartthingsDiscovery");
    var response;

    hbDevices = new Homebridges(endPoints, this);
    // debug("RESPONSE", JSON.stringify(hbDevices, null, 2));
    response = hbDevices.toSmartThings(this, message);

    // debug("RESPONSE", JSON.stringify(response, null, 2));

    response.event.payload.endpoints = checkDeviceList.call(this, response.event.payload.endpoints);
    response.event.payload.endpoints = removeLargeCookieEndpoints.call(this, response.event.payload.endpoints);
    response.event.payload.endpoints = removeDuplicateEndpoints.call(this, response.event.payload.endpoints);

    var deleteSeen = [];

    for (var i = 0; i < response.event.payload.endpoints.length; i++) {
      var endpoint = response.event.payload.endpoints[i];
      if (deleteSeen[endpoint.friendlyName]) {
        this.log("WARNING: Duplicate device name", endpoint.friendlyName);
        // response.event.payload.endpoints.splice(i, 1);
      } else {
        deleteSeen[endpoint.friendlyName] = true;
      }
    }

    if (response && response.event.payload.endpoints.length < 1) {
      this.log("ERROR: HAP Discovery failed, please review config");
    } else {
      if (process.uptime() > 600) { // Only use console during startup
        debug("smartthingsDiscovery - returned %s devices", response.event.payload.endpoints.length);
      } else {
        this.log("smartthingsDiscovery - returned %s devices", response.event.payload.endpoints.length);
      }
      if (response.event.payload.endpoints.length > 300) {
        this.log("ERROR: Maximum devices/accessories of 300 exceeded.");
      }
    }
    // debug("Discovery Response", JSON.stringify(response, null, 2));
    if (this.debug) {
      //  const fs = require('fs');
      //  fs.writeFileSync('iftttDiscovery.json', JSON.stringify(response, null, 2));
    }
    callback(null, response);
  }.bind(this));
}



function removeLargeCookieEndpoints(endpoints) {
  var response = [];
  endpoints.forEach((endpoint) => {
    debug("Cookie Object: ", JSON.stringify(endpoint.cookie).length);
    if (JSON.stringify(endpoint.cookie).length < 5000) {
      response.push(endpoint);
    } else {
      console.log("ERROR: Large endpoint Cookie, removing endpointID =>", endpoint.friendlyName);
    }
  });

  // console.log(response.length);
  // console.log(response);
  return (response);
}

function removeDuplicateEndpoints(endpoints) {
  var deleteSeen = [];
  var response = [];
  endpoints.forEach((endpoint) => {
    if (deleteSeen[endpoint.endpointId]) {
      this.log("ERROR: Parsing failed, removing duplicate endpointID =>", endpoint.friendlyName);
    } else {
      response.push(endpoint);
    }
    deleteSeen[endpoint.endpointId] = true;
  });
  return (response);
}

function checkDeviceList(endpoints) {
  if (this.deviceList && this.deviceList.length > 0 && ['allow', 'deny'].includes(this.deviceListHandling)) {
    this.log(`INFO: DeviceList - The following devices are ${this.deviceListHandling} =>`, this.deviceList);
    var response = [];
    endpoints.forEach((endpoint) => {
      if (this.deviceListHandling === "allow") {
        if (verifyDeviceInList(this.deviceList, endpoint.friendlyName)) {
          response.push(endpoint);
          this.log("INFO: DeviceList - allow =>", endpoint.friendlyName);
        }
      } else if (this.deviceListHandling === "deny") {
        if (verifyDeviceInList(this.deviceList, endpoint.friendlyName)) {
          this.log("INFO: DeviceList - deny =>", endpoint.friendlyName);
        } else {
          response.push(endpoint);
        }
      }
    });
    return (response);
  } else {
    // this.log("INFO: DeviceList empty feature not enabled or config error in deviceListHandling");
    return endpoints;
  }
}

function verifyDeviceInList(deviceList, deviceName) {
  for (var i = 0, len = deviceList.length; i < len; i++) {
    if (deviceName === deviceList[i] || deviceName.match(new RegExp(deviceList[i]))) return true;
  }
  return false;
}


function smartthingsEvent(events) {
  debug("Events", JSON.stringify(events));
  // create smartthings message
  events.forEach(function(event) {
    // debug('smartthingsEvent - event', event);
    var x = {
      'deviceID': event.deviceID,
      'aid': event.aid,
      'iid': event.iid
    };
    var device;

    switch (event.status) {
      case true:
      case false:
      case 1:
      case 0:
        if (event.value !== undefined) {
          device = hbDevices.toEvents(JSON.stringify(x), deviceList_global);
          debug('smartthingsEvent - device', device);
          
          db.insertEvent(device.friendlyName, device.deviceType, event);
          
          // TODO: send event to smartthings
          
         
        } else {
          debug("Event message not being sent - no value", event);
        }
        break;
      default:
        debug("Event message not being sent - invalid state", event);
    }
  });
}

