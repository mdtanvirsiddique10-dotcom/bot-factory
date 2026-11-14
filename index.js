const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');

const app = express();
let qrCode = '';
let status = 'QR আসতেছে...';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Bot Factory', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      qrCode = await QRCode.toDataURL(qr);
      status = 'QR রেডি - স্ক্যান করো';
    }
    if (connection === 'open') {
      status = '✅ লিংক হয়ে গেছে!';
      qrCode = '';
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
      else {
        fs.rmSync('./auth', { recursive: true, force: true });
        status = 'Logged Out - পেজ Refresh দাও';
        startBot();
      }
    }
  });

  // অটো রিপ্লাই
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (!text) return;
    const jid = m.key.remoteJid;
    if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
      await sock.sendMessage(jid, { text: 'Hello! আমি Bot Factory বট, কেমন আছো? 😊' });
    } else {
      await sock.sendMessage(jid, { text: 'মেসেজ পাইছি: ' + text });
    }
  });
}

startBot();

app.get('/', (req, res) => {
  res.send(`<h1>Bot Factory - Baileys (হালকা)</h1><h2>${status}</h2>${qrCode ? `<img src="${qrCode}" width="300">` : ''}<p>পেজটি ৫ সেকেন্ড পর পর Refresh হবে</p><script>setTimeout(()=>location.reload(),5000)</script>`);
});

app.listen(10000, () => console.log('Baileys Bot চালু! Port 10000'));
