let express = require('express');
let router = express.Router();
const config = require('./config.js');
const db = require('./db/db.js');
const {SchemaConnector, DeviceErrorTypes, StateUpdateRequest, DiscoveryRequest, DiscoveryDevice} = require('st-schema');
const api = require('./smartthings-api.js');
const debug = require('debug')('smartthings-connector');
const smartthingsActions = require('../smartthingsActions.js');

const platform = 'smartthings';

db.open();


/*
    Define the smartthings cloud schema connector
*/

var connector_ST;
var accessTokens_ST = {}; // the data structure is for convenient use of st-schema APIs
var client_id_ST;

db.getPToken(platform).then((ptoken) => {
  if(ptoken) {
    client_id_ST = ptoken.client_id;
    const callbackAuthentication = {tokenType: "Bearer", accessToken: ptoken.access_token, refreshToken: ptoken.refresh_token, expiresIn: ptoken.expires_in};
    const callbackUrls = {oauthToken: ptoken.token_url, stateCallback: ptoken.callback_url};
    accessTokens_ST[ptoken.keyword] = {callbackAuthentication, callbackUrls};
  }
  connector_ST = new SchemaConnector()
  .clientId(config.smartthings.client_id)
  .clientSecret(config.smartthings.client_secret)
  .discoveryHandler(async (accessToken, response) => {
    await db.getDevices().then((devices) => {
      var dev;
      for (dev of devices) {
        // addDevice('Wemo Mini', 'Wemo Mini_2:10', ['switch'])
        var device = response.addDevice(dev.device_id, `${dev.device_id}_${dev.aid}:${dev.iid}`, api.findDeviceHandlerTypeFromAttributes([api.deviceTypes2attributes[dev.device_type]]));
        // add manufacturerInfo properties to the device
        device.manufacturerName('default');
        device.modelName('default');
        device.hwVersion('default');
        device.swVersion('default');
      }
    })
    return response;
  })
  .stateRefreshHandler(async (accessToken, response, body) => {
    var requestedDevice;
    await db.getStates().then((all_states) => {
      if (all_states) {
        for (requestedDevice of body.devices) {
          var states = [];
          for (each_state of all_states) {
            if(each_state.device_id === requestedDevice.externalDeviceId) {
              states.push(each_state);
            }
          }
          response.addDevice(requestedDevice.externalDeviceId, formatDBStates4ST(states));  
        }
      }
    });
    return response;
  })
  .commandHandler(async (accessToken, response, devices) => {
      
    var receiveCmdTime = new Date().getTime();
    debug("receive command from ST at: ", receiveCmdTime);
    
    var requestedDevice = devices[0];
    db.getDevice(requestedDevice.externalDeviceId).then(device => {
      let aid = device.aid;
      let iid = device.iid;
      let promises = [];
      for(let cmd of requestedDevice.commands) {
        // send smartthings command to homebridge accessory. 
        var cmdValue = api.stCmd2HapValue(cmd); 
        promises.push(smartthingsActions.smartthings2homebridge(aid, iid, cmdValue));
      }
      
      Promise.allSettled(promises).then(() => {
        response.addDevice(requestedDevice.externalDeviceId);
        return response;
      });
    })
    .catch(err => {
      console.error("command handler error:", err);
      response.addDevice(requestedDevice.externalDeviceId);
      return response;
    })
  })
  .callbackAccessHandler(async (accessToken, callbackAuthentication, callbackUrls) => {
    debug('callbackAuthentication: ', callbackAuthentication);
    debug('callbackUrls: ', callbackUrls);
    accessTokens_ST[accessToken] = {
      callbackAuthentication,
      callbackUrls
    }
    // client_id_ST = clientId;
    token = {};
    token.client_id = config.smartthings.client_id;
    token.platform = platform;
    token.keyword = accessToken;
    token.access_token = callbackAuthentication.accessToken;
    token.refresh_token = callbackAuthentication.refreshToken;
    token.expires_in = callbackAuthentication.expiresIn;
    token.token_url = callbackUrls.oauthToken;
    token.callback_url = callbackUrls.stateCallback;
    db.updatePToken(token);
  })
  .integrationDeletedHandler(accessToken => {
    delete accessTokens_ST[accessToken]
  });
  connector_ST.enableEventLogging(2, config.verbose);

});

// /integration is requested by SmartThings automatically
router.post('/', (req, res) => {
  if(validateSTTokens(req)) {
    debug('interactionType: ', req.body.headers.interactionType);
    connector_ST.handleHttpCallback(req, res);
  } else {
    res.status(401).send({
      "errors": [
        {
          "message": "The access token is invalid!"
        }
      ]
    });
  }
});



router.post('/api/stateupdate', (req, res) => {
  if (!req.body.deviceState) {
    return res.send('Device state is not given!');
  }
  const deviceState = req.body.deviceState;
  //console.log("================", deviceState);
  var accessToken;
  for (accessToken in accessTokens_ST) {
    //console.log(accessToken);
    var sendEventTime = new Date().getTime();
    debug("Send event to ST at: ", sendEventTime);
    const stateUpdateRequest = new StateUpdateRequest(config.smartthings.client_id, config.smartthings.client_secret);
    stateUpdateRequest.updateState(accessTokens_ST[accessToken].callbackUrls, accessTokens_ST[accessToken].callbackAuthentication, deviceState, async (refreshCallbackAuthentication) => {
       //console.log("here2");  
       accessTokens_ST[accessToken].callbackAuthentication = refreshCallbackAuthentication;
       //db.updateTokens(accessTokens_ST);
       token = {};
       token.client_id = client_id_ST;
       token.platform = platform;
       token.keyword = accessToken;
       token.access_token = refreshCallbackAuthentication.accessToken;
       token.refresh_token = refreshCallbackAuthentication.refreshToken;
       token.expires_in = refreshCallbackAuthentication.expiresIn;
       token.token_url = accessTokens_ST[accessToken].callbackUrls.oauthToken;
       token.callback_url = accessTokens_ST[accessToken].callbackUrls.stateCallback;
       db.updatePToken(token).catch(err => {console.error(err);});
    }).then(res => {
      res = JSON.stringify(res);
      //console.log("res:", res);
      return res;
    }) // expecting a json response
    .then(json => {
      // console.log(json)
    }, err => {
      console.log(err)
    }).finally(() => {});
  }
  res.send("successful!");
});



router.post('/api/discoveryupdate', (req,res) => {
  if(!req.body.devices) {
    return res.send('Devices are not given!');
  }
  const devices = req.body.devices;
  var accessToken;

  for (accessToken in accessTokens_ST) {
    const discoveryRequest = new DiscoveryRequest(config.smartthings.client_id, config.smartthings.client_secret);
    var idx;
    for (idx in devices) {
      discoveryRequest.addDevice(devices[idx]);
    }
    var result = discoveryRequest.sendDiscovery(accessTokens_ST[accessToken].callbackUrls, accessTokens_ST[accessToken].callbackAuthentication, (refreshCallbackAuthentication) => {
      accessTokens_ST[accessToken].callbackAuthentication = refreshCallbackAuthentication;
      //db.updateTokens(accessTokens_ST);
      token = {};
      token.client_id = client_id_ST;
      token.platform = platform;
      token.keyword = accessToken;
      token.access_token = refreshCallbackAuthentication.accessToken;
      token.refresh_token = refreshCallbackAuthentication.refreshToken;
      token.expires_in = refreshCallbackAuthentication.expiresIn;
      token.token_url = accessTokens_ST[accessToken].callbackUrls.oauthToken;
      token.callback_url = accessTokens_ST[accessToken].callbackUrls.stateCallback;
      db.updatePToken(token).catch(err => {console.error(err);});
    }).then(res => {
      res = JSON.stringify(res);
      return res;
    }).catch(err => {console.log("err:", err);})
  }
  res.send("successful!");
});




function validateSTTokens(req) {
  return true;
}


// format the states for assembling state refresh response
function formatDBStates4ST(device_states) {
  // debug("before formatDBStates4ST: ", device_states);
  var states = [];
  var attributes = [];
  for (let each_state of device_states) {
    var state = {};
    state.component = 'main';
    // mapping every device_type to one capability defined by ST cloud (e.g., Outlet --> st.switch)
    state.capability = api.findCapabilityFromAttribute(api.deviceTypes2attributes[each_state.device_type]);
    state.attribute = api.deviceTypes2attributes[each_state.device_type];   // mapping 'Outlet' to 'switch'
    state = api.sanitizeValue(state, each_state);
    // debug('state: ', state);
    states.push(state);
    attributes.push(state.attribute);
  }
  // make up the discrepancy of capabilities between SmartThings and local, this is because SmartThings and DeviceConnector may identify different attributes for the same devices; 
  // to integrate SmartThings, we try to match the most possible DHT based on identified attributes by constructing modified DHT2Capabilities_local;
  // however, to report states, capabilities must match the DHT; hence, we make up the missed capabilities.
  const dht = api.findDeviceHandlerTypeFromAttributes(attributes);
  // debug('Most matched deviceHandlerType: ', dht);
  
  let capabilities = [];
  
  // find all matched capabilities for each device
  for(let attr of attributes) {
    capabilities.push(api.findCapabilityFromAttribute(attr));
  }
  
  const capabilities_ST = api.DHT2Capabilities_ST[dht];
  // debug("capabilities_ST: ", capabilities_ST);
  // find missing capabilities compared to real defined DHT&capabilities mapping
  const missed_capabilities = capabilities_ST.filter(cap => !capabilities.includes(cap));
  var cap;
  for(cap of missed_capabilities) {
    const missed_attrs = api.Capabilities2Attributes[cap];
    for(attr of missed_attrs) {
      var state = {};
      state.component = 'main';
      state.capability = cap;
      state.attribute = attr;
      state = api.makeupDefaultValue(state);
      states.push(state);
    }
  }
  
  let healthState = {};
  healthState.component = 'main';
  healthState.capability = 'st.healthCheck';
  healthState.attribute = 'healthStatus';
  healthState.value = 'online';

  states.push(healthState);
  
  // debug("after formatDBStates4ST: ", states);
  return states;
  
}

/*

// format the deviceState for state callback
function formatEvent4ST(device_id, device_type, event) {
  return new Promise((resolve, reject) => {
    devicestate = {};
    devicestate["externalDeviceId"] = device_id;
    var attributes = [];
    
    attributes.push(device_type);
    // assemble the states
    var states = [];
    var promises = [];
    for (let attr of attributes) {
      // if (attr === event.attribute) {   // there is no event attribute in hap events
      if (true) {  // thus set true as default
        let state = {};
        state.component = 'main';
        state.capability = api.findCapabilityFromAttribute(attr);
        state.attribute = attr;
        source = {};
        source.value = event.value;
        state = api.sanitizeValue(state, source);
        states.push(state); 
      } else {
        promises.push(db.getState(device_id, attr));
      }
    }
    Promises.all(promises).then((data) => {
      var each;
      for(each of data) {
        var state = {};
        const capability = api.findCapabilityFromAttribute(each.attribute);
        debug('formatEvent4ST - capability: ', capability);
        if (capability) {
          state.component = 'main';
          state.capability = capability;
          state.attribute = each.attribute;
          state = api.sanitizeValue(state, each);
          states.push(state); 
        } else {
          throw('failed to find the corresponding capability of attribute: ', each.attribute);
        }
      }
      // make up the discrepancy of capabilities between SmartThings and local, this is because SmartThings and DeviceConnector may identify different attributes for the same devices; 
      // to integrate SmartThings, we try to match the most possible DHT based on identified attributes by constructing modified DHT2Capabilities_local;
      // however, to report states, capabilities must match the DHT; hence, we make up the missed capabilities.
      const dht = api.findDeviceHandlerTypeFromAttributes(attributes); // find the device handler type that emits the event;
      let capabilities = [];
      for(let attr of attributes) {
        capabilities.push(api.findCapabilityFromAttribute(attr));
      }
      const capabilities_ST = api.DHT2Capabilities_ST[dht];
      const missed_capabilities = capabilities_ST.filter(cap => !capabilities.includes(cap));
      var cap;
      for(cap of missed_capabilities) {
        const missed_attrs = api.Capabilities2Attributes[cap];
        for(attr of missed_attrs) {
          var state = {};
          state.component = 'main';
          state.capability = cap;
          state.attribute = attr;
          state = api.makeupDefaultValue(state);
          states.push(state);
        }
      }
      devicestate["states"] = states;
      debug("formatEvent4ST - event:", JSON.stringify(event), "deviceState:", [devicestate], "states:", devicestate.states);
      resolve([devicestate]);  
    }).catch(err => { console.error(err); })
  });
}


function formatDevice4ST(device, device_id, device_type) {
  var attributes = [];
  attributes.push(device_type);
  const dht = api.findDeviceHandlerTypeFromAttributes(attributes);
  
  if(dht) {
    var newdevice = new DiscoveryDevice(device_id, `${device_id}_${device.aid}:${device.iid}`, dht);
    newdevice.manufacturerName('default');
    newdevice.modelName('default');
    newdevice.hwVersion('default');
    newdevice.swVersion('default');
    return [newdevice];
  } else {
    console.error('cannot find the device handler type of device with attributes: ', attributes);
  }
}


function pushDeviceToTargetPlatform(device, device_id, device_type) {
  const device_ST = formatDevice4ST(device, device_id, device_type);
  if(device_ST) {
    api.push_device_discovery(device_ST);
  } else {
    debug('error pushing device to smartthings cloud: ', device_id);
  }
}



function pushEventToTargetPlatform(device_id, device_type, event) {
  formatEvent4ST(device_id, device_type, event).then((deviceState) => {
    api.push_device_state(deviceState);
  });
}

*/



module.exports = router;

//module.exports = {
//  router_connector_ST: router
  // formatEvent4ST: formatEvent4ST,
  // formatDevice4ST: formatDevice4ST,
  // pushDeviceToTargetPlatform: pushDeviceToTargetPlatform,
  // pushEventToTargetPlatform: pushEventToTargetPlatform
//};


