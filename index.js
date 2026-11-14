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

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (!text) return;
    if (text.startsWith('Hello!') || text.startsWith('মেসেজ পাইছি') || text.startsWith('🤖')) return;
    const jid = m.key.remoteJid;
    const low = text.toLowerCase().trim();

    let reply = '';

    if (low === 'hi' || low === 'hello' || low === 'hey' || low === 'হাই') {
      reply = 'Hello! আমি Bot Factory বট, কেমন আছো? 😊\n\nমেনু দেখতে *menu* লিখো';
    } else if (low === 'menu' || low === 'মেনু') {
      reply = '🤖 *Bot Factory মেনু*\n\n1. *hi* - হ্যালো\n2. *dam* - দাম জানতে\n3. *client* - ক্লায়েন্টের জন্য বট\n4. *order* - অর্ডার করতে\n5. *help* - সাহায্য';
    } else if (low.includes('dam') || low.includes('দাম') || low.includes('price')) {
      reply = '💰 *দাম লিস্ট:*\n\n✅ সাধারণ অটো রিপ্লাই বট - 500 টাকা\n✅ মেনু + অর্ডার বট - 1500 টাকা\n✅ ফুল বিজনেস বট - 3000 টাকা\n\nঅর্ডার করতে *order* লিখো';
    } else if (low.includes('client') || low.includes('ক্লাইন্ট')) {
      reply = '👨‍💼 ক্লায়েন্টের জন্য বট লাগবে?\n\nআমরা দোকান, রেস্টুরেন্ট, কোচিং এর জন্য বট বানাই দিই।\nদাম জানতে *dam* লিখো';
    } else if (low.includes('order') || low.includes('অর্ডার')) {
      reply = '✅ অর্ডার নেওয়া হয়েছে!\nআপনার নাম আর ঠিকানা পাঠান, আমরা যোগাযোগ করবো।';
    } else if (low.includes('ki kor') || low.includes('কি কর') || low.includes('কেমন আছ')) {
      reply = 'আমি ভালো আছি! 😊 তুমি কেমন আছো?\nমেনু দেখতে *menu* লিখো';
    } else if (low === 'help') {
      reply = 'সাহায্য লাগলে *menu* লিখো, সব অপশন দেখতে পারবা।';
    } else {
      reply = '🤖 বুঝতে পারি নাই।\nমেনু দেখতে *menu* লিখো';
    }

    await sock.sendMessage(jid, { text: reply });
  });
}

startBot();

app.get('/', (req, res) => {
  res.send(`<h1>Bot Factory - Baileys (হালকা)</h1><h2>${status}</h2>${qrCode ? `<img src="${qrCode}" width="300">` : ''}<p>পেজটি ৫ সেকেন্ড পর পর Refresh হবে</p><script>setTimeout(()=>location.reload(),5000)</script>`);
});

app.listen(10000, () => console.log('Baileys Bot চালু! Port 10000'));
