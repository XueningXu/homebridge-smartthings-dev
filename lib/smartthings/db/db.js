const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const randtoken = require('rand-token');
const Account = require('./account.js');

let VERBOSE = false;

const TABLES = [
  'tokens', 'urls'
];


const Database = {
  db: null,
  open: function() {
    if (this.db) {
      return;
    }
    let filename;
    let exists = false;
    filename = path.join('/home/ceron-dev/Desktop/sqlite_db/', 'db.smartthings.sqlite3');
    console.log('database file path: ', filename);
	  
    let removeBeforeOpen = false;
    
    // Check if database already exists
    exists = fs.existsSync(filename);
    if (exists && removeBeforeOpen) {
      fs.unlinkSync(filename);
      exists = false;
    }
    console.log(exists ? 'Opening' : 'Creating', 'database:', filename);
    // Open database or create it if it doesn't exist
    this.db = new sqlite3.Database(filename);
    console.log('Database successfully created!');
    // Set a timeout in case the database is locked. 10 seconds is a bit long,
    // but it's better than crashing.
    this.db.configure('busyTimeout', 10000);
    
    this.db.serialize(() => {
      this.createTables();
    });
  },
    
  createTables: function() {
    // create authentication table, recording the tokens that have been issued to external platform.
    this.db.run('CREATE TABLE IF NOT EXISTS Authentication (' + 
      'client_id TEXT,' + 
      'platform TEXT,' +
      'code TEXT,' +
      'access_token TEXT,' +
      'refresh_token TEXT,' +
      'expires_in TEXT,' +
      'expires TEXT,' +
      'primary key (platform)' +
    ');', (err) => {
      if(err) {
        console.error('error creating table Authentication: ' + err);
      }
    });
    
    
    // create tokens table, recording the tokens obtained from external platform. oauthToken: url for requesting accessToken; deprecated!
    this.db.run('CREATE TABLE IF NOT EXISTS Tokens (' + 
      'platform TEXT,' +
      'keyword TEXT,' +
      'accessToken TEXT,' +
      'refreshToken TEXT,' +
      'expiresIn TEXT,' +
      'oauthToken TEXT,' +
      'stateCallback TEXT,' +
      'primary key (platform, keyword)' +
    ');', (err) => {
      if (err) {
        console.error('error creating table Tokens: '+ err);
      }
    });
    
    
    //create PTokens table, the tokens obtained from platforms. client_id: client_id of the target platform
    this.db.run('CREATE TABLE IF NOT EXISTS PTokens (' +
      'client_id TEXT,' +
      'platform TEXT,' +
      'keyword TEXT,' +
      'access_token TEXT,' +
      'refresh_token TEXT,' +
      'expires_in TEXT,' +
      'token_url TEXT,' + 
      'callback_url TEXT,' +
      'primary key (platform)' +                 
    ');', (err) => {
      if (err) {
        console.error('error creating table PTokens: ' + err);
      }
    });
   
    
    
    // create Devices table (device_id, aid, iid, device_type)
    this.db.run('CREATE TABLE IF NOT EXISTS Devices (' +
      'device_id TEXT,' + 
      'aid INTEGER,' +
      'iid INTEGER,' +
      'device_type TEXT,' +
      'primary key (device_id)' +
    ');', (err) => {
      if(err) {
        console.error(`error creating table Devices: ` + err);
      }
    });
	  
	  
    // create device current states table (device_id)
    this.db.run('CREATE TABLE IF NOT EXISTS States (' + 
      'device_id TEXT,' +
      'aid INTEGER,' +
      'iid INTEGER,' +
      'device_type TEXT,' +
      'value TEXT,' +
      'primary key (device_id, device_type),' +
      'foreign key (device_id) references Devices(device_id)' +
    ');', (err) => {
       if(err) {
        console.error(`error creating table States:` + err);
       }
    });
    

    
    
    // create device events table (id, device_id, attribute, value, t)
    this.db.run('CREATE TABLE IF NOT EXISTS Events (' + 
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'device_id TEXT,' +
      'aid INTEGER,' +
      'iid INTEGER,' +
      'device_type TEXT,' +
      'value INTEGER,' +
      'timestamp TEXT,' +
      'locale_time TEXT,' +
      'foreign key (device_id) references Devices(device_id)' +
    ');', (err) => {
      if(err) {
        console.error(`error creating table Events: ` + err);
      }
    });
	  
    // create Account table (username, salt, password, uid)
    this.db.run('CREATE TABLE IF NOT EXISTS Accounts (' +
      'username TEXT PRIMARY KEY,' +
      'salt TEXT,' +
      'password TEXT,' +
      'uid TEXT' +
    ');', (err) => {
      if(err) {
        console.error(`error creating table Accounts: ` + err);
      }
    });
    
      
    // create triggers table (id, device_id, trigger_identity)
    this.db.run('CREATE TABLE IF NOT EXISTS TriggersIDs (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'device_id TEXT,' +
      'trigger_identity TEXT' +
    ');', (err) => {
      if(err) {
        console.error(`error creating table TriggersIDs: ` + err);
      }  
    });
  },
  
  
  
  // generate a code for issuing authorization
  initializeAuthenticationToken(username, client_id, expiresIn, platform) {
    const code = randtoken.generate(16).toString();
    const accessToken = "";
    const refreshToken = "";
    const expires = expirationDate(expiresIn);
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM Authentication WHERE platform=?', platform, (err, row) => {
        if(err) { reject(err); }
        if(row) {
          console.error('code already exists');
          this.db.run('UPDATE Authentication SET expiresIn=?, expires=? WHERE platform=?', [expiresIn, expirationDate(expiresIn), platform], (err) => {
            reject(err.message);
          });
          resolve(row.code);
        } else {
          this.db.run('INSERT INTO Authentication(client_id, platform, code, access_token, refresh_token, expires_in, expires) VALUES(?, ?, ?, ?, ?, ?, ?)', 
                      [client_id, platform, code, accessToken, refreshToken, expiresIn, expires], (err) => {
            if (err) {
              console.error('error when add code', err);
              reject(err);
            }
            resolve(code);
          });
        }
      });
    });
  },
  
  
  getAuthenticationToken(platform) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM Authentication WHERE platform=?', platform, (err, row) => {
        if(err) {
          reject(err.message);
        } else {
          if(!row) {
            reject(`Cannot find entries with platform = ${platform}`);
          }
          resolve(row);
        }
      });
    });
  },
  
  redeemAuthenticationCode(platform) {
    return new Promise((resolve, reject) => {
      this.getAuthenticationToken(platform).then(row => {
        const now = new Date().getTime()/1000;
        if (now > row.expires) {
          reject('The authorization code expires.');
        } else {
          const access_token = randtoken.generate(24).toString();
          const refresh_token = row.code;
          const expires = expirationDate(row.expires_in);
          this.db.run('UPDATE Authentication SET access_token=?, refresh_token=?, expires=? WHERE platform=?', 
                      [access_token, refresh_token, expires, platform], (err) => {
            if(err) { reject(err); }
            else {
              resolve({client_id: row.client_id, platform: row.platform, access_token: access_token, refresh_token: refresh_token, expires_in: row.expires_in, expires: expires, token_type: 'Bearer'});
            }
          });
        }
      });
    });
  },
  
  
  async addAccount(username, password) {
    await this.db.get('SELECT * FROM Accounts WHERE username=?', username, (err, row) => {
      if(err) { console.error(err.message); }
      if(row) { console.error("username already exists"); }
      else {
        const account = new Account().initialize(username, password);
        this.db.run('INSERT INTO Accounts(username, password, salt, uid) VALUES(?, ?, ?, ?)', [account.username, account.password, account.salt, account.uid], (err) => {
          if(err) { console.error(err); }
          else {
            return account;
          }
        });
      }
    });
  },
  
  
  getAccount(username){
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * From Accounts WHERE username = ?', username, (err, row) => {
        if(err) {
          console.error(err.message);
          reject(err.message);
        } else {
          if(!row) {
            console.error(`Cannot find account with username: ${username}`);
            reject(`Cannot find account with username: ${username}`);
          }
          const account = new Account().fromDb(row);
          resolve(account);
        }
      });
    });
  },
  
  // use the first account as default user
  getDefaultAccount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * From Accounts', (err, row) => {
        if(err) {
          reject(err.message);
        } else {
          if(!row) {
            reject(`Cannot find account`);
          } 
          const account = new Account().fromDb(row);
          delete account.password;
          delete account.salt;
          resolve(account);
        }
      });
    });
  },
  
  

  
  // update tokens from accessing platforms
  updatePToken(token) {
    return new Promise((resolve, reject) => {
      var keyword;
      if(Object.keys(token).includes('keyword')) { keyword = token.keyword; } else { keyword = ""; }
      this.db.run('DELETE FROM PTokens WHERE platform=?', token.platform, (err) => {
        if(err) { reject(err); }
        else {
          this.db.run('INSERT INTO PTokens(client_id, platform, keyword, access_token, refresh_token, expires_in, token_url, callback_url) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', 
                     [token.client_id, token.platform, keyword, token.access_token, token.refresh_token, token.expires_in, token.token_url, token.callback_url], (err) => {
            if(err) { reject('error adding entry: ' + err); }
            resolve();
          });
        }
      });
    });
  },
  
  
  // query tokens
  getPToken: function(platform) {
    return new Promise( (resolve, reject) => {
      this.db.get('SELECT * FROM PTokens WHERE platform=?', platform, (err, row) => {
        if(err) {
          return console.error(err.message);
        }
        if (!row) {
          resolve();
        } else {
          var token = {};
          token.client_id = row.client_id;
          token.platform = row.platform;
          token.keyword = row.keyword;
          token.access_token = row.access_token;
          token.refresh_token = row.refresh_token;
          token.expires_in = row.expires_in;
          token.token_url = row.token_url;
          token.callback_url = row.callback_url;
          resolve(token);
        }
      });
    }); 
  },
  
  
  
  
  // insert smartthings-exposed devices to database
  // [
  //  '{"deviceID":"XX:XX:XX:XX:XX:XX","aid":2,"iid":10}': 
  //  {endpointID: 'XXXXXX', deviceType: 'Outlet', friendlyName: 'Wemo Mini'}
  // ]  
  insertDevice: function(device, deviceType, friendlyName) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM Devices WHERE device_id = ?', friendlyName, (err, row) => {
        if(err) {reject(err);}
        if(row) {
          this.db.run('DELETE FROM Devices WHERE device_id = ?', friendlyName, (err) => {
            if(err) {reject(err);}
            this.db.run('INSERT INTO Devices(device_id, aid, iid, device_type) VALUES(?, ?, ?, ?)', [friendlyName, device.aid, device.iid, deviceType], (err) => {
              if(err) {reject(err);}
              var newdevice = {};
              newdevice.device_id = friendlyName;
              newdevice.aid = device.aid;
              newdevice.iid = device.iid;
              newdevice.deviceType = deviceType;
              console.log(newdevice);
              resolve(newdevice);
            });
          });
        } else {
          this.db.run('INSERT INTO Devices(device_id, aid, iid, device_type) VALUES(?, ?, ?, ?)', [friendlyName, device.aid, device.iid, deviceType], (err) => {
            if(err) {reject(err);}
            var newdevice = {};
            newdevice.device_id = friendlyName;
            newdevice.aid = device.aid;
            newdevice.iid = device.iid;
            newdevice.deviceType = deviceType;
            console.log(newdevice);
            resolve(newdevice);
          });
        }
      });
    });
  },
	
	
  // insert device state to database
  insertState: function(device, value, deviceType, friendlyName) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM States WHERE device_id=? and device_type=?', [friendlyName, deviceType], (err,row) => {
        if(err) {reject(err);}
        if(row){
          this.db.run('DELETE FROM States WHERE device_id=? and device_type=?', [friendlyName, deviceType], (err) => {
            if(err) reject(err);
            this.db.run('INSERT INTO States(device_id, aid, iid, device_type, value) VALUES(?, ?, ?, ?, ?)', [friendlyName, device.aid, device.iid, deviceType, value], (err) => {
              if(err) { reject('Error when inserting states' + err); }
              var state = {};
              state.uid = friendlyName;
              state.aid = device.aid;
              state.iid = device.iid;
              state.type = deviceType;
              state.value = value;
              resolve(state);
            });
          });
        } else {
          this.db.run('INSERT INTO States(device_id, aid, iid, device_type, value) VALUES(?, ?, ?, ?, ?)', [friendlyName, device.aid, device.iid, deviceType, value], (err) => {
            if(err) { reject('Error when inserting states' + err); }
            var state = {};
            state.uid = friendlyName;
            state.aid = device.aid;
            state.iid = device.iid;
            state.type = deviceType;
            state.value = value;
            resolve(state);
          });
        }
      });
    });
  },
	
	
  
  getDevice(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM Devices WHERE device_id=?', id, (err, row) => {
        if(err) {reject(err);}
        if(row) {
          let device = row;
          resolve(device);
        } else {
          resolve();
        }
      });
    });
  },
	
  getDevices() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM Devices', (err, rows) => {
        if(err) { reject(err); }
        if(rows) {
          var device;
          var devices = [];
          for (device of rows) {
            //var newdevice = device;
            devices.push(device);
          }
          resolve(devices);
        } else {
          resolve();
        }
      });
    });
  },

    
   // Get events based on device_id and device_type
  // limit determines how many maximum events are returned
  // ordered by timestamp descending
  // Takes in a comparison operator and uses that to get events
  getEvents(friendlyName, deviceType, value, limit, comp_op) {
    if (value) {
      return new Promise((resolve, reject) => {
        let statement;
        if (comp_op == '=') {
          statement = 'SELECT * FROM Events WHERE device_id=? AND device_type=? AND value=? ORDER BY timestamp DESC LIMIT ? ';
        } else if (comp_op == '>') {
          statement = 'SELECT * FROM Events WHERE device_id=? AND device_type=? AND value>CAST(? as REAL) ORDER BY timestamp DESC LIMIT ? ';
        } else if (comp_op == '<') {
          statement = 'SELECT * From Events WHERE device_id=? AND device_type=? AND value<CAST(? as REAL) ORDER BY timestamp DESC LIMIT ? ';
        } else {
          reject('Unkown comparison operatior');
        }
        this.db.all(statement, [friendlyName, deviceType, value, limit], (err, row) => {
          if(err) {reject(err);}
          if(row) {
            resolve(row);
          } else {
            reject('Cannot find the events: ', friendlyName, deviceType);
          }
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM Events WHERE device_id=? AND device_type=? ORDER BY timestamp DESC LIMIT ? ', [friendlyName, deviceType, limit], (err, row) => {
          if(err) {reject(err);}
          if(row) {
            resolve(row);
          } else {
            reject('Cannot find the events: ', friendlyName, deviceType);
          }
        });
      });
    }
  },
	
	
	// get one device with the specified device_type
  getOneDevice(deviceType) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM Devices WHERE device_type=? LIMIT 1', [deviceType], (err, row) => {
        if(err) {reject(err);}
        if(row) {
          resolve(row);
        } else {
          reject('Cannot find the device: ', deviceType);
        }
      });
    });
  },


		
  // return all devices with specified type
  getDeviceIDsWithDeviceType: function(deviceType) {
    if (deviceType) {
      return new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM Devices WHERE device_type=?', [deviceType], (err, rows) => {
          if(err) {reject(err);}
          if(rows) {
            let ids = [];
            rows.forEach(row => {
              ids.push(row.device_id);
            });
            resolve(ids);
          } else {
            reject('Cannot find the device with Type: ', deviceType);
          }
        });
      });
    }
  },


  // insert to Events when a new event comes from homebridge
  insertEvent: function(friendlyName, deviceType, event) {
    return new Promise( (resolve, reject) => {
      this.db.run('INSERT INTO Events(device_id, aid, iid, device_type, value, timestamp, locale_time) VALUES(?, ?, ?, ?, ?, ?, ?)', [friendlyName, event.aid, event.iid, deviceType, event.value, getTimestamp(), getLocaleTime()], (err) => {
        if(err) { reject(err); }
        resolve();
      });
    });
  },
  
  
  // update current state of accessory
  updateState(friendlyName, deviceType, event) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE States SET value=? WHERE device_id=? and device_type=?', [event.value, friendlyName, deviceType], (err) => {
        if(err) { reject(err); }
        resolve();
      });
    });
  },
	
	// get all devices states
	getStates() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM States', (err, rows) => {
        if(err) { reject(err); }
        if(rows) {
          resolve(rows);
        } else {
          resolve();
        }
      });
    });
  },


  // Add a trigger identity to the database
  setTriggerIdentity: function(friendlyName, trigger_identity) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO TriggersIDs(device_id, trigger_identity) VALUES(?, ?)', [friendlyName, trigger_identity], (err) => {
        if(err) {reject('error adding entry: ' + err);}
        resolve(true);
      });
    });
  },

  // return array of triggers by device_id
  getTriggerIdentities: function(friendlyName) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM TriggersIDs WHERE device_id=?', [friendlyName], (err, row) => {
        if(err) {reject(err);}
        if(row) {
          resolve(row);
        } else {
          reject('Cannot find the TriggersIDs: ', friendlyName);
        }
      });
    });
  },

  // return array of triggers by trigger_identity
  getTriggerIdentity: function(trigger_identity) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM TriggersIDs WHERE trigger_identity=?', [trigger_identity], (err, row) => {
        if(err) {reject(err);}
        resolve(row);
      });
    });
  },


  // Delete trigger_identity
  removeTriggerID: function(trigger_identity) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM TriggersIDs WHERE trigger_identity=?', [trigger_identity], (err) => {
        if(err) {reject(err);}
        resolve(true);
      });
    });
  }
}


function getLocaleTime() {
  const localestring = new Date().toLocaleString();
  const [date_string, time_string] = localestring.split(',');
  const new_locale_string = time_string + ', ' + date_string;
  //console.log(new_locale_string);
  return new_locale_string;
}


function getTimestamp() {
  return new Date();
}


function expirationDate(expiresIn) {
	return Math.round(new Date().getTime()/1000) + expiresIn;
}


module.exports = Database;
