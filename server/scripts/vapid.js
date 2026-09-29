'use strict';
// Génère une paire de clés VAPID pour les notifications push navigateur.
const { generateVAPIDKeys } = require('web-push');
const k = generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
