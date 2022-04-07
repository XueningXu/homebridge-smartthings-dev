'use strict';
const os = require('os');
const path = require('path');
const home = os.homedir();


module.exports = {
  smartthings: {
    account_name: 'tuh35729@temple.edu',
    mp_client_id: 'mpmediator-client-id', // granted to smartthings
    mp_client_secret: 'mpmediator-client-secret',
    client_id: "6e9a404b-546b-4dfb-95b2-61b57fa0f118", // granted by smartthings to mp-mediator
    client_secret: "9a5ae29fa9548680806866946513df0c5d4cee8c725b3d2d585453f9a91cffa9f7114b84ae08251bb2b556d4783d4011fc2aee608c61e03c6659cf3c2b254c93d09ce4869f49fde4588983c9f76734535bf8bd5ce686e6bfbb5876ffc8517d816668f434506a8a7fcb84e60b5f43a591c87b838b79a2087845a3d247ea4e86e6d5621bac301e1f0207c63b9e6807621cf09f6eec8d6c062fcea6db0281c97fb3d56cc1d094d19774744286b916ab9e1b1b777396201bbc8d58a09fb0c78bb831f5f7fd836d7a13bf1c953db3d8cbd40fc3b91b457033c4e00766217998550f9278acb74f41e71058609c5a1f6011b4c90da4a4e229da59c9fbfe415736c2793c",
    //client_id: "41236ce5-cd75-49e0-b570-b8dab207759b",
    //client_secret: "2b7b7e719946f32f7c9fc4aedc3ef5cc9a75ff42444107ae35ec0821e59c01f8672d2142315a2a25cfa5068cd0bc67e9ac7f3cf99aae68a7d6adfcebc2c156414ca4345da5889cdd56da3139a835969dbaa6f7539e1170b9595d15384c2d83f59808c9933411b67fdb4b49600a571a9fc254123b08d50b92dc2f97ba956657b7e22e5cfe8d33e1e800ea6a139848033f0cec3eb20a73613ab4df6ff9ad69a8e22a7fb058a41c026d280c6c287d36677f83bb6877dfefd4480c9f6bd86d5a197f569c502e73fd150f62bd15ba24b264801ba6fcbcaa7a1214bc7fd27f42a90a85bd54e8b171a30852c017283a99ff2db411c638b6057d0c9fc18d92ad9d5c0fc0",
    permitted_redirect_urls: "https://c2c-us.smartthings.com/oauth/callback,https://c2c-eu.smartthings.com/oauth/callback,https://c2c-ap.smartthings.com/oauth/callback,https://c2c-globals.smartthingsgdev.com/oauth/callback,https://c2c-globald.smartthingsgdev.com/oauth/callback,https://c2c-uss.smartthingsgdev.com/oauth/callback,https://c2c-eus.smartthingsgdev.com/oauth/callback,https://c2c-usd.smartthingsgdev.com/oauth/callback"
  }

}
