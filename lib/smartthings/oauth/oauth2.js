const debug = require('debug')('smartthingsOauth2');
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

debug('permittedRedirectUrls: ', permittedRedirectUrls);

let redirect_uri;
let client_state;

function now() {
  return Math.round(new Date().valueOf() / 1000)
}


function errorMsg(descr, expected, actual) {
  return "expected " + descr + ": " + expected + ", actual: " + actual;
}

function validateAccessTokenRequest(req, res) {
  let success = true, msg;
  
  //debug('token request headers: ', req.headers);
  // extract client_id and client_secret in req in the base64 encoded authorization in headers
  let authorization = req.headers.authorization.split(' ')[1];
  authorization = Buffer.from(authorization, 'base64').toString('ascii');
  authorization = authorization.split(':');
  
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
    res.render('invalidauth', {
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
    debug('redirect_uri :', redirect_uri);
    if (req.query.state) {
      req.session.client_state = req.query.state;
      client_state = req.query.state;
    }
    requesting_client_id = req.query.client_id;
    res.render('login', {  // the path to .ejs files relative to views
      query: req.query,
      errorMessage: ''
    })
  }
}

async function authRedirect(req, res) {
  db.initializeAuthenticationToken(req.session.username, requesting_client_id, 84600, platform).then(code => {
    let location = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=${code}`;
    debug("location: ", location);
    if (client_state) {
      location += "&state=" + client_state;
    }
    // send the generated code as response to Oauth2 request issued from SmartThings Cloud
    // the code will be further used for token request issued from SmartThings Cloud
    res.writeHead(307, {"Location": location, "rejectUnauthorized": false});
    res.end();
  }).catch(err => { console.error(err); });
}


async function loginCheck(req, res) {
  const account = db.getAccount(req.query.email).then(account => {
    if ((account && !account.passwordMatches(req.query.password)) || !account) { // account does not exist or password does not match
      // Render error message for bad password or signing to non-existant account
      console.log("login failed");
      res.render('login', {
        query: req.query,
        errorMessage: 'Invalid username or password'
      });
    } else { // Login successfully
      if(!req.session) {
        req.session = {};
      }
      req.session.username = req.query.email;
      req.session.expires_in = req.query.expires_in
      authRedirect(req, res)
    }
  }).catch(err => { console.error(err.message); });
}


// OAuth login page displayed by ST mobile app
router.get('/auth', authRequestHandler);

// Handler when user signs in
router.get("/login-as", loginCheck);

router.get("/redirect", authRedirect);


router.post('/token', async (req, res) => {
  if (validateAccessTokenRequest(req,res)) {  // check the client id and secret
    let authorization = req.headers.authorization.split(' ')[1];
    authorization = Buffer.from(authorization, 'base64').toString('ascii');
    authorization = authorization.split(':');
    const client_id = authorization[0];
    await db.redeemAuthenticationCode(platform).then(token => {
      if(token) {
        res.send(token);
      } else {
        res.status(401).send('Invalid grant type');
      }
    }).catch(err => { console.error(err); });
  }
  res.end();
});



module.exports = router;


