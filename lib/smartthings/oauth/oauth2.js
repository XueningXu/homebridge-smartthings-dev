const express = require('express');
const router = express.Router();
const config = require('../config.js');
const _ = require("underscore");
const db = require('../db/db.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const platform = "smartthings";

// the local client id and secret
const clientId = config.smartthings.mp_client_id || "mpmediator-client-id";
const clientSecret = config.smartthings.mp_client_secret || "mpmediator-client-secret";

// the requested client id and secret
var requesting_client_id;
const permittedRedirectUrls = (config.smartthings.permitted_redirect_urls ?
  `${config.domain}/smartthings/oauth2/redirect,${config.smartthings.permitted_redirect_urls}` :
  `${config.domain}/smartthings/oauth2/redirect,https://c2c-us.smartthings.com/oauth/callback,https://c2c-eu.smartthings.com/oauth/callback,https://c2c-ap.smartthings.com/oauth/callback`)
  .split(',');

let redirect_uri;
let client_state;

function now() {
  return Math.round(new Date().valueOf() / 1000)
}


function errorMsg(descr, expected, actual) {
  return "expected " + descr + ": " + expected + ", actual: " + actual
}

function validateAccessTokenRequest(req, res) {
  let success = true, msg;
  // extract client_id and client_secret in req in the base64 encoded authorization in headers
  let authorization = req.headers.authorization.split(' ')[1];
  authorization = Buffer.from(authorization, 'base64').toString('ascii');
  authorization = authorization.split(';');
  
  const client_id = authorization[0];
  const client_secret = authorization[1];
  
  if (client_secret !== clientSecret) {
    msg = `Invalid clientSecret, received ${req.body.client_secret}, expected ${clientSecret}`;
    success = false;
    console.error(msg);
  } else if (client_id !== clientId) {
    msg = `Invalid clientId, received ${req.body.client_secret} expected ${clientId}`;
    success = false;
    console.error(msg);
  }
  return success;
}


function validateAuthPageRequest(req, res) {
  const errorMessages = [];
  if (req.query.client_id !== clientId) {
    errorMessages.push(`Invalid client_id, received '${req.query.client_id}', expected '${clientId}'`);
  }
  
  if (req.query.response_type !== "code") {
    errorMessages.push(`Invalid response type, received '${req.query.response_type}' expected 'code'`);
  }
  
  if (!(permittedRedirectUrls.includes(req.query.redirect_uri))) {
    errorMessages.push(`Invalid redirect_uri, received '${req.query.redirect_uri}' expected one of ${permittedRedirectUrls.join(', ')}`);
  }
  
  if (errorMessages.length > 0) {
    res.status(401);
    res.render('oauth/smartthings/invalidauth', {
      errorMessages: errorMessages
    });
    return false;
  }
  return true;
}

function authRequestHandler(req, res) {
  if (validateAuthPageRequest(req, res)) {
    if (!req.session) {
      req.session = {};
      req.session.redirect_uri = req.query.redirect_uri;
    } else {
      req.session.redirect_uri = req.query.redirect_uri;
    }
    
    redirect_uri = req.query.redirect_uri;
    if (req.query.state) {
      req.session.client_state = req.query.state;
      client_state - req.query.state;
    }
    requesting_client_id = req.query.client_id;
    res.render('oauth/smartthings/login', {
      query: req.query,
      errorMessage: ''
    })
  }
}

















