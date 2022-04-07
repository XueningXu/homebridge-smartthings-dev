'use strict';
const os = require('os');
const path = require('path');
const home = os.homedir();


module.exports = {
  smartthings: {
    account_name: 'tuh35729@temple.edu',
    mp_client_id: 'mpmediator-client-id', // granted to smartthings
    mp_client_secret: 'mpmediator-client-secret',
    client_id: "c4a817e2-ad49-4603-9fc1-e4e499090c59", // granted by smartthings to mp-mediator
    client_secret: "8f15e3b11cd0744b5e5d0a3887e47e7a21658107a0ea884c58578aeec2c1cd0feeb794be743a265f6dc26b79098691d2e2ce4bd7fc120061c556986ccdb7a7df453be9d35002f923fb27bf121dc96cf0073c68c090b5f4041ca536d53564fcc078780cebeb8d9a31a33a38e63f290ed09b0244ac9f2f8a5d8ed079ffdf5dff1febe3d6441ce2c335639ae9e48a27659cb334ba5cce33c05df4f09a1d0295f5ce31b82af4f58bf3d72411477d497561ba34e7bfa9fae317000f6bdd24febd928656d7794579677caf616a34e00cbf52c814760854761380c6711cc7b67ec3e1598b0cc25c5b24b78f55bf5a077efadd7b68c6e4cd9ad8b055541f8cac904be3c8",
    //client_id: "41236ce5-cd75-49e0-b570-b8dab207759b",
    //client_secret: "2b7b7e719946f32f7c9fc4aedc3ef5cc9a75ff42444107ae35ec0821e59c01f8672d2142315a2a25cfa5068cd0bc67e9ac7f3cf99aae68a7d6adfcebc2c156414ca4345da5889cdd56da3139a835969dbaa6f7539e1170b9595d15384c2d83f59808c9933411b67fdb4b49600a571a9fc254123b08d50b92dc2f97ba956657b7e22e5cfe8d33e1e800ea6a139848033f0cec3eb20a73613ab4df6ff9ad69a8e22a7fb058a41c026d280c6c287d36677f83bb6877dfefd4480c9f6bd86d5a197f569c502e73fd150f62bd15ba24b264801ba6fcbcaa7a1214bc7fd27f42a90a85bd54e8b171a30852c017283a99ff2db411c638b6057d0c9fc18d92ad9d5c0fc0",
    permitted_redirect_urls: "https://c2c-us.smartthings.com/oauth/callback,https://c2c-eu.smartthings.com/oauth/callback,https://c2c-ap.smartthings.com/oauth/callback,https://c2c-globals.smartthingsgdev.com/oauth/callback,https://c2c-globald.smartthingsgdev.com/oauth/callback,https://c2c-uss.smartthingsgdev.com/oauth/callback,https://c2c-eus.smartthingsgdev.com/oauth/callback,https://c2c-usd.smartthingsgdev.com/oauth/callback"
  }

}
