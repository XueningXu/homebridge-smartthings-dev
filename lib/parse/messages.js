var debug = require('debug')('smartthings:Messages');

module.exports = {
  lookupCapabilities: lookupCapabilities,
  lookupDisplayCategory: lookupDisplayCategory,
  reportState: reportState,
  cookie: cookie,
  cookieV: cookieV,
  normalizeName: normalizeName,
  checkEventDeviceList: checkEventDeviceList,
  createMessageId: createMessageId
};



function createMessageId() {
  var d = new Date().getTime();

  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
    function(c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

  return uuid;
}



function lookupCapabilities(capability, options, operations, devices) {
  var response = [];
  switch (capability) {
    case "PlaybackController":
      // debug("operations", Object.keys(operations));
      var supported = Object.keys(operations);
      supported = supported.filter(function(item) {
        return item !== 'ReportState';
      });
      // debug("supported", supported);
      response.push({
        type: "SmartThingsInterface",
        interface: "SmartThings.PlaybackController",
        version: "3",
        supportedOperations: supported
      });
      break;
    case "ChannelController":
      response.push({
        type: "SmartThingsInterface",
        interface: "SmartThings.ChannelController",
        version: "3",
        properties: {
          supported: [{
            name: "channel"
          }],
          proactivelyReported: false,
          retrievable: true
        }
      });
      break;
    case "Input Source":
      var supported = Object.keys(operations);
      supported = supported.filter(function(item) {
        return item.substring(0, 10) !== 'Station - ';
      });
      var inputs = [];
      supported.forEach((item, i) => {
        inputs.push({
          name: item
        });
      });

      response.push({
        type: "SmartThingsInterface",
        interface: "SmartThings.InputController",
        version: "3",
        properties: {
          supported: [{
            name: "input"
          }],
          proactivelyReported: false,
          retrievable: true
        },
        inputs: inputs
      });
      break;
    case "ThermostatController":
      // debug("operations", Object.keys(operations));
      var ops = Object.keys(operations);
      // debug("Supp", ops);
      var supported = [];
      ops.forEach(function(key) {
        if (key === "thermostatModeOFF" || key === "upperSetpoint" || key === "lowerSetpoint" || key === "targetSetpoint") {
          if (key.substring(0, 14) === "thermostatMode") {
            key = "thermostatMode";
          }
          supported.push({
            "name": key
          });
        }
      });
      // debug("supported", supported);
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.ThermostatController",
        "version": "3",
        "properties": {
          "supported": supported,
          "proactivelyReported": false,
          "retrievable": true
        },
        "configuration": {
          "supportsScheduling": false,
          "supportedModes": [
            "HEAT",
            "COOL",
            "AUTO",
            "OFF"
          ]
        }
      });
      break;
    case "Volume":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.Speaker",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "volume"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Volume Selector":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.StepSpeaker",
        "version": "3"
      });
      break;
    case "Color Temperature":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.ColorTemperatureController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "colorTemperatureInKelvin"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "ColorController":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.ColorController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "color"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Rotation Speed": // RotationSpeed
    case "Brightness": // Brightness
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.PowerLevelController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "powerLevel"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Target Position":
      if (options.blind) {
        // Range Controller version
        debug("Target Position", devices);
        if (!devices) {
          devices = {};
        }
        if (!devices.maxValue) {
          devices.maxValue = 100;
        }
        if (!devices.minValue) {
          devices.minValue = 0;
        }
        response.push({
          "type": "SmartThingsInterface",
          "interface": "SmartThings.RangeController",
          "instance": "Blind.Lift",
          "version": "3",
          "properties": {
            "supported": [{
              "name": "rangeValue"
            }],
            "proactivelyReported": false,
            "retrievable": true
          },
          "capabilityResources": {
            "friendlyNames": [{
              "@type": "asset",
              "value": {
                "assetId": "SmartThings.Setting.Opening"
              }
            }]
          },
          "configuration": {
            "supportedRange": {
              "minimumValue": devices.minValue,
              "maximumValue": devices.maxValue,
              "precision": 1
            },
            "unitOfMeasure": "SmartThings.Unit.Percent"
          },
          "semantics": {
            "actionMappings": [{
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Close"],
                "directive": {
                  "name": "SetRangeValue",
                  "payload": {
                    "rangeValue": 0
                  }
                }
              },
              {
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Open"],
                "directive": {
                  "name": "SetRangeValue",
                  "payload": {
                    "rangeValue": devices.maxValue
                  }
                }
              },
              {
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Lower"],
                "directive": {
                  "name": "AdjustRangeValue",
                  "payload": {
                    "rangeValueDelta": -10,
                    "rangeValueDeltaDefault": false
                  }
                }
              },
              {
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Raise"],
                "directive": {
                  "name": "AdjustRangeValue",
                  "payload": {
                    "rangeValueDelta": 10,
                    "rangeValueDeltaDefault": false
                  }
                }
              }
            ],
            "stateMappings": [{
                "@type": "StatesToValue",
                "states": ["SmartThings.States.Closed"],
                "value": devices.minValue
              },
              {
                "@type": "StatesToRange",
                "states": ["SmartThings.States.Open"],
                "range": {
                  "minimumValue": 1,
                  "maximumValue": devices.maxValue
                }
              }
            ]
          }
        });
      } else {
        // Original logic
        response.push({
          "type": "SmartThingsInterface",
          "interface": "SmartThings.PowerController",
          "version": "3",
          "properties": {
            "supported": [{
              "name": "powerState"
            }],
            "proactivelyReported": false,
            "retrievable": true
          }
        });
        response.push({
          "type": "SmartThingsInterface",
          "interface": "SmartThings.PowerLevelController",
          "version": "3",
          "properties": {
            "supported": [{
              "name": "powerLevel"
            }],
            "proactivelyReported": false,
            "retrievable": true
          }
        });
      }

      break;
    case "Target Door State":
      if (options.door) {
        // Mode Controller version
        response.push({
          "type": "SmartThingsInterface",
          "interface": "SmartThings.ModeController",
          "instance": "GarageDoor.Position",
          "version": "3",
          "properties": {
            "supported": [{
              "name": "mode"
            }],
            "retrievable": true,
            "proactivelyReported": false
          },
          "capabilityResources": {
            "friendlyNames": [{
              "@type": "asset",
              "value": {
                "assetId": "SmartThings.Setting.Mode"
              }
            }]
          },
          "configuration": {
            "ordered": false,
            "supportedModes": [{
                "value": "Position.Up",
                "modeResources": {
                  "friendlyNames": [{
                    "@type": "asset",
                    "value": {
                      "assetId": "SmartThings.Value.Open"
                    }
                  }]
                }
              },
              {
                "value": "Position.Down",
                "modeResources": {
                  "friendlyNames": [{
                    "@type": "asset",
                    "value": {
                      "assetId": "SmartThings.Value.Close"
                    }
                  }]
                }
              }
            ]
          },
          "semantics": {
            "actionMappings": [{
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Close", "SmartThings.Actions.Lower"],
                "directive": {
                  "name": "SetMode",
                  "payload": {
                    "mode": "Position.Down"
                  }
                }
              },
              {
                "@type": "ActionsToDirective",
                "actions": ["SmartThings.Actions.Open", "SmartThings.Actions.Raise"],
                "directive": {
                  "name": "SetMode",
                  "payload": {
                    "mode": "Position.Up"
                  }
                }
              }
            ],
            "stateMappings": [{
                "@type": "StatesToValue",
                "states": ["SmartThings.States.Closed"],
                "value": "Position.Down"
              },
              {
                "@type": "StatesToValue",
                "states": ["SmartThings.States.Open"],
                "value": "Position.Up"
              }
            ]
          }
        });
      } else {
        // Original version
        response.push({
          "type": "SmartThingsInterface",
          "interface": "SmartThings.PowerController",
          "version": "3",
          "properties": {
            "supported": [{
              "name": "powerState"
            }],
            "proactivelyReported": false,
            "retrievable": true
          }
        });
      }
      break;
    case "Active": // Active on a Fan 2 aka Dyson or Valve
    case "On":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.PowerController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "powerState"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Lock Target State":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.LockController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "lockState"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Current Temperature":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.TemperatureSensor",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "temperature"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Preset":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.ChannelController",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "channel"
          }],
          "proactivelyReported": false,
          "retrievable": true
        }
      });
      break;
    case "Motion Detected":
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.MotionSensor",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "detectionState"
          }],
          "proactivelyReported": options.events,
          "retrievable": true
        }
      });
      break;
    case "Contact Sensor State": // Contact Sensor State
    case "Current Position":
    case "Current Door State": // Current Door state
    case "Occupancy Detected": // Occupancy Sensor
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.ContactSensor",
        "version": "3",
        "properties": {
          "supported": [{
            "name": "detectionState"
          }],
          "proactivelyReported": options.events,
          "retrievable": true
        }
      });
      break;
    case "Programmable Switch Event": // Doorbell
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.DoorbellEventSource",
        "version": "3",
        "proactivelyReported": true
      });
      break;
    case "Remote Key": // Current Door state
      response.push({
        "type": "SmartThingsInterface",
        "interface": "SmartThings.PlaybackController",
        "version": "3",
        "supportedOperations": ["Play", "Pause", "Stop", "Next", "Rewind"]
      });
      break;
    default:
      // Missing capabilities
      // debug("ERROR: Missing capability", capability);
      break;
  }
  // debug("lookupCapabilities", response);
  return response;
}



function normalizeName(id) {
  switch (id) {
    case "0000003E":
      return ("Accessory Information");
    case "000000BB":
      return ("Air Purifier");
    case "0000008D":
      return ("Air Quality Sensor");
    case "00000096":
      return ("Battery Service");
    case "00000097":
      return ("Carbon Dioxide Sensor");
    case "0000007F":
      return ("Carbon Monoxide Sensor");
    case "00000080":
      return ("Contact Sensor");
    case "00000081":
      return ("Door");
    case "00000121":
      return ("Doorbell");
    case "00000040":
      return ("Fan");
    case "000000B7":
      return ("Fan v2");
    case "000000BA":
      return ("Filter Maintenance");
    case "000000D7":
      return ("Faucet");
    case "00000041":
      return ("Garage Door Opener");
    case "000000BC":
      return ("Heater Cooler");
    case "000000BD":
      return ("Humidifier Dehumidifier");
    case "00000082":
      return ("Humidity Sensor");
    case "000000CF":
      return ("Irrigation System");
    case "00000083":
      return ("Leak Sensor");
    case "00000084":
      return ("Light Sensor");
    case "00000043":
      return ("Lightbulb");
    case "00000044":
      return ("Lock Management");
    case "00000045":
      return ("Lock Mechanism");
    case "00000112":
      return ("Microphone");
    case "00000085":
      return ("Motion Sensor");
    case "00000086":
      return ("Occupancy Sensor");
    case "00000047":
      return ("switch");  // changed Outlet to be switch, for match attribute in smartthings cloud
    case "0000007E":
      return ("Security System");
    case "000000CC":
      return ("Service Label");
    case "000000B9":
      return ("Slat");
    case "00000087":
      return ("Smoke Sensor");
    case "00000113": // Speaker Service
      return ("Speaker");
    case "00000089":
      return ("Stateless Programmable Switch");
    case "00000049":
      return ("Switch");
    case "0000008A":
      return ("Temperature Sensor");
    case "0000004A":
      return ("Thermostat");
    case "000000D0":
      return ("Valve");
    case "0000008B":
      return ("Window");
    case "0000008C":
      return ("Window Covering");
    case "00000111":
      return ("Camera");
    case "00000098": // Apple TV
      return ("Apple TV");
    case "000000D8": // Service Television
      return ("Television");
    case "000000D9": // Service "Input Source"
      return ("Input Source");
    default:
      // debug("Missing HB Type", id);
  }
}


function lookupDisplayCategory(service) {
  var category;
  switch (service.substr(0, 8)) {
    case "00000113": // SPEAKER
      category = ["SPEAKER"];
      break;
    case "000000D8": // Service "Television"
    case "00000098": // TV
      category = ["TV"];
      break;
    case "00000043": // lightbulb
      category = ["LIGHT"];
      break;
    case "0000008C": // Window Covering
      category = ["INTERIOR_BLIND"];
      break;
    case "000000D0": // Valve / Sprinkler
      category = ["OTHER"];
      break;
    case "00000041": // Garage Door
      category = ["GARAGE_DOOR"];
      break;
    case "00000045": // Garage Door
      category = ["SMARTLOCK"];
      break;
    case "00000047":
      // Outlet
      category = ["SMARTPLUG"];
      break;
    case "00000049":
    case "000000BB": // Air purifier
    case "000000BD": // Humidifier Dehumidifier
      // Switch
      category = ["SWITCH"];
      break;
    case "00000040": // Fan
    case "000000B7": // Fan2
      category = ["FAN"];
      break;
    case "0000008A":
      category = ["TEMPERATURE_SENSOR"];
      break;
    case "00000080":
    case "00000086": // Occupancy Sensor
      category = ["CONTACT_SENSOR"];
      break;
    case "00000121": // Doorbell
      category = ["DOORBELL"];
      break;
    case "00000085":
      category = ["MOTION_SENSOR"];
      break;
    case "0000004A":
    case "000000BC":
      category = ["THERMOSTAT"];
      break;
    default:
      // No mapping exists
      // debug("No display category for %s using other", service.substr(0, 8));
      category = ["OTHER"];
      break;
  }
  return category;
}


function reportState(_interface, context) {
  return {
    "interface": _interface,
    "deviceID": context.deviceID,

    "aid": context.aid,
    "iid": context.liid
  };
}

function cookie(context) {
  return JSON.stringify({
    "deviceID": context.deviceID,

    "aid": context.aid,
    "iid": context.liid
  });
}

function cookieV(_value, context) {
  return JSON.stringify({
    "deviceID": context.deviceID,

    "aid": context.aid,
    "iid": context.liid,
    "value": _value
  });
}



function checkEventDeviceList(endpoints) {
  if (this.deviceList && this.deviceList.length > 0 && ['allow', 'deny'].includes(this.deviceListHandling)) {
    debug(`INFO: DeviceList - The following devices are ${this.deviceListHandling} =>`, this.deviceList);
    var response = [];
    for (var key in endpoints) {
      var endpoint = endpoints[key];
      if (this.deviceListHandling === "allow") {
        if (verifyDeviceInList(this.deviceList, endpoint.friendlyName)) {
          response[key] = endpoint;
          debug("INFO: DeviceList - allow =>", endpoint.friendlyName);
        }
      } else if (this.deviceListHandling === "deny") {
        if (verifyDeviceInList(this.deviceList, endpoint.friendlyName)) {
          debug("INFO: DeviceList - deny =>", endpoint.friendlyName);
        } else {
          response[key] = endpoint;
        }
      }
    }
    return (response);
  } else {
    debug("INFO: DeviceList empty feature not enabled or config error in deviceListHandling");
    return endpoints;
  }
}

function verifyDeviceInList(deviceList, deviceName) {
  for (var i = 0, len = deviceList.length; i < len; i++) {
    if (deviceName === deviceList[i] || deviceName.match(new RegExp(deviceList[i]))) return true;
  }
  return false;
}
