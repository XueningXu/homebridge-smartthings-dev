let express = require('express');
let router = express.Router();
const config = require('./config.js');
const db = require('./db/db.js');
const {SchemaConnector, DeviceErrorTypes, StateUpdateRequest, DiscoveryRequest, DiscoveryDevice} = require('st-schema');
const api = require('./smartthings-api.js');
const debug = require('debug')('smartthings-connector');

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
        // addDevice('Wemo Mini', '2:10', 'Outlet'--> defined attribute), TODO: change device_type as an array
        var device = response.addDevice(dev.device_id, `${dev.aid}:${dev.iid}`, api.findDeviceHandlerTypeFromAttributes([dev.device_type]));
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
  .commandHandler()
  
  
});



// format the states for assembling state refresh response
function formatDBStates4ST(device_states) {
  debug("before formatDBStates4ST: ", device_states);
  var states = [];
  var attributes = [];
  for (let each_state of device_states) {
    var state = {};
    state.component = 'main';
    // mapping every device_type to one capability defined by ST cloud (e.g., Outlet --> st.switch)
    state.capability = api.findCapabilityFromAttribute(each_state.device_type);
    state.attribute = each_state.device_type;
    state = api.sanitizeValue(state, each_state);
    debug('state: ', state);
    states.push(state);
    attributes.push(each_state.device_type);
  }
  // make up the discrepancy of capabilities between SmartThings and local, this is because SmartThings and DeviceConnector may identify different attributes for the same devices; 
	// to integrate SmartThings, we try to match the most possible DHT based on identified attributes by constructing modified DHT2Capabilities_local;
	// however, to report states, capabilities must match the DHT; hence, we make up the missed capabilities.
  const dht = api.findDeviceHandlerTypeFromAttributes(attributes);
  debug('Most matched deviceHandlerType: ', dht);
  
  let capabilities = [];
  
  // find all matched capabilities for each device
  for(let attr of attributes) {
    capabilities.push(api.findCapabilityFromAttribute(attr));
  }
  
  const capabilities_ST = api.DHT2Capabilities_ST[dht];
  debug("capabilities_ST: ", capabilities_ST);
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
  
  debug("after formatDBStates4ST: ", states);
	return states;
  
}
