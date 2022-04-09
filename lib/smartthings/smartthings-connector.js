let express = require('express');
let router = express.Router();
const config = require('./config.js');
const db = require('./db/db.js');
const {SchemaConnector, DeviceErrorTypes, StateUpdateRequest, DiscoveryRequest, DiscoveryDevice} = require('st-schema');
const api = require('./smartthings-api.js');

const platform = 'smartthings';

db.open();


/*
    Define the smartthings cloud schema connector
*/

var connector_ST;
var accessTokens_ST = {}; // the data structure is for convenient use of st-schema APIs
var client_id_ST;

