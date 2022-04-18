var debug = require('debug')('smartthings:Homebridges');
var Homebridge = require('./Homebridge.js').Homebridge;
// var messageUtil = require('../util/messageUtil');
var messages = require('./messages');

module.exports = {
  Homebridges: Homebridges
};

/*
 * Homebridges -> Homebridge -> Accessory -> Service -> Characteristic
 */

function Homebridges(devices, context) {
  // debug("Homebridges", devices);
  this.homebridges = [];
  devices.forEach(function(element) {
    var homebridge = new Homebridge(element, context);
    this.homebridges.push(homebridge);
  }.bind(this));
}

/**
 * Homebridges.toList - description
 *
 * @param  {type} opt description
 * @return {type}     description
 */

Homebridges.prototype.toList = function(opt) {
  var list = [];
  for (var index in this.homebridges) {
    var homebridge = this.homebridges[index];
    // list.push(homebridge.toList());
    list = list.concat(homebridge.toList(opt));
  }

  list.sort((a, b) => (a.sortName > b.sortName) ? 1 : ((b.sortName > a.sortName) ? -1 : 0));
  // debug("opt",opt,list.length);
  return (list);
};

Homebridges.prototype.toSmartThings = function(opt, message) {
  var list = [];
  for (var index in this.homebridges) {
    var homebridge = this.homebridges[index];
    // list.push(homebridge.toList());
    list = list.concat(homebridge.toSmartThings(opt));
  }

  list.sort((a, b) => (a.endpointId > b.endpointId) ? 1 : ((b.endpointId > a.endpointId) ? -1 : 0));
  // debug("opt",opt,list.length);
  // debug("MESSAGE", message);
  var messageId = (message ? message.directive.header.messageId : '');
  var response = {
    "event": {
      "header": {
        "namespace": "SmartThings.Discovery",
        "name": "Discover.Response",
        "payloadVersion": "3",
        "messageId": messageId
      },
      "payload": {
        "endpoints": list
      }
    }
  };
  /*
  // debug("PreCombine", JSON.stringify(list, null, 2));
  if (opt.inputs) {
    response = messages.inputs(opt, response);
  }
  if (opt.channel) {
    response = messages.channel(opt, response);
  }
  if (opt.combine) {
    response = messages.combine(opt, response);
  }
  */
  // debug("toSmartThings - Done");
  return (response);
};


Homebridges.prototype.toEvents = function(endpoint, deviceList=[]) {
  // debug("toEvents");
  var list = [];
  this.homebridges.forEach(function(homebridge) {
    // debug("accessories", homebridge.accessories.length);
    for (var index in homebridge.accessories) {
      var accessory = homebridge.accessories[index];
      debug('accessory name: ', accessory.name);
       if (verifyDeviceInList(deviceList, accessory.info.Name)) {
          var deviceID = accessory.deviceID;
          for (var index in accessory.services) {
            var service = accessory.services[index];
            var deviceType = service.service;
            var endpointID = service.endpointID;
            for (var index in service.characteristics) {
              // check characteristics in order to focus on desired characteristics of accessories
              if ( (['On', 'Lock Target State', 'Smoke Detected', 'Leak Detected'].includes(service.characteristics[index].description)) || 
                  (service.characteristics[index].description === 'Security System Target State' && accessory.name === 'SimpliSafe 3') || 
                  (service.characteristics[index].description === 'Contact Sensor State' && accessory.name.includes('MP st contact')) || 
                  (service.characteristics[index].description === 'Motion Detected' && accessory.name.includes('MP st motion')) ) {
                var aid = service.characteristics[index].aid;
                var iid = service.characteristics[index].iid;
                var value = service.characteristics[index].value;
                var key_dict = {
                  'deviceID': deviceID,
                  'aid': aid,
                  'iid': iid
                };
                var value_dict = {
                  'value': value,
                  'endpointID': endpointID,
                  'deviceType': deviceType,
                  'friendlyName': accessory.info.Name
                };
                var key_str =  JSON.stringify(key_dict);
                var hapEvents = {};
                hapEvents[key_str] = value_dict;
                debug('hapEvents: ', hapEvents);
                list = Object.assign(list, hapEvents);
              } else {   // not On characteristics
                continue;
              }
            }
          }
        }
    }
  });
  debug('Devices in the deviceList: ', list);
  if (endpoint) {
    // debug("toEvents", endpoint, list[endpoint]);
    return list[endpoint];
  } else {
    return (list);
  }
};



/*
Homebridges.prototype.toEvents = function(endpoint) {
  // debug("toEvents");
  var list = [];
  this.homebridges.forEach(function(homebridge) {
    // debug("accessories", homebridge.accessories.length);
    for (var index in homebridge.accessories) {
      var accessory = homebridge.accessories[index];
      // debug("services", accessory.services.length);
      // accessory.services.forEach(function(service) {
      for (var index in accessory.services) {
        var service = accessory.services[index];
        // debug("characteristics", service.characteristics.length);
        for (var index in service.characteristics) {
          var hapEvents = service.characteristics[index].hapEvents;
          if (Object.keys(hapEvents).length > 0) {
            list = Object.assign(list, hapEvents);
            // debug("hapEvents", hapEvents, Object.keys(hapEvents).length);
            // debug("List", list);
          }
        }
      }
    }
  });
  if (endpoint) {
    // debug("toEvents", endpoint, list[endpoint]);
    return list[endpoint];
  } else {
    return (list);
  }
};
*/

/* {
  "characteristics": [{
    "aid": endpoint.aid,
    "iid": endpoint.iid,
    "ev": true
  }]
};
*/

Homebridges.prototype.findDevice = function(node) {
  var list = [];
  for (var index in this.homebridges) {
    var homebridge = this.homebridges[index];
    // list.push(homebridge.toList());
    list = list.concat(homebridge.toList());
  }
  return (list.find(x => x.uniqueId === node));
};



function verifyDeviceInList(deviceList, deviceName) {
  for (var i = 0, len = deviceList.length; i < len; i++) {
    if (deviceName === deviceList[i] || deviceName.match(new RegExp(deviceList[i]))) return true;
  }
  return false;
}
