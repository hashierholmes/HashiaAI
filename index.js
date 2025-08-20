const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const config = require('./config');
const { sendMessage, sendImage, sendTypingOn, sendTypingOff, setupMessengerProfile } = require('./services/messengerApi');
const { loadSystemInstruction, handleTextMessage, handleImageMessage } = require('./services/geminiService');
const { handlePinterest } = require('./services/pinterestService');

const app = express();
const PORT = 3000;

app.use(express.json());

const chatHistory = new Map();

// WEBHOOK VERIFICATION ENDPOINT
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.FACEBOOK_VERIFY_TOKEN) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      console.error('Webhook verification failed: Token mismatch or invalid mode.');
      res.sendStatus(403);
    }
  } else {
    console.error('Webhook verification failed: Missing mode or token in query parameters.');
    res.sendStatus(400);
  }
});

// WEBHOOK ENDPOINT FOR RECEIVING MESSAGES
app.post('/webhook', async (req, res) => {
  const body = req.body;
  const senderId = req.body?.entry?.[0]?.messaging?.[0]?.sender?.id;

  if (senderId) {
    await sendTypingOn(senderId);
  }

  if (body.object === 'page') {
    for (const entry of body.entry) {
      if (entry.messaging) {
        for (const webhookEvent of entry.messaging) {
          console.log('Received webhook event:', JSON.stringify(webhookEvent, null, 2));

          const currentSenderId = webhookEvent.sender.id;

          if (webhookEvent.message && webhookEvent.message.text) {
            const messageText = webhookEvent.message.text.trim();

            if (messageText.toLowerCase().startsWith('/pinterest')) {
              await handlePinterest(currentSenderId, messageText);
              await sendTypingOff(currentSenderId);
            } else {
              await handleMessage(webhookEvent, chatHistory);
              await sendTypingOff(currentSenderId);
            }
          } else if (webhookEvent.message) {
            // FALLBACK TO HANDLE OTHER MESSAGE TYPES LIKE ATTACHMENTS
            await handleMessage(webhookEvent, chatHistory);
            await sendTypingOff(currentSenderId);
          } else if (webhookEvent.postback) {
            await handlePostback(webhookEvent, chatHistory);
            await sendTypingOff(currentSenderId);
          }
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.error('Received webhook event with invalid object type or missing messaging data.', JSON.stringify(body, null, 2));
    res.sendStatus(404);
  }
});

// HANDLE INCOMING MESSAGES
async function handleMessage(event, chatHistory) {
  const senderId = event.sender.id;
  const message = event.message;

  try {
    if (!chatHistory.has(senderId)) {
      chatHistory.set(senderId, []);
    }

    const userHistory = chatHistory.get(senderId);
    let response;

    if (message.attachments) {
      const imageAttachments = message.attachments.filter(att => att.type === 'image');

      if (imageAttachments.length > 0) {
        response = await handleImageMessage(senderId, imageAttachments, message.text || '', chatHistory);
      } else {
        response = await handleTextMessage(senderId, message.text || 'I received an attachment that I cannot process.', chatHistory);
      }
    } else if (message.text) {
      response = await handleTextMessage(senderId, message.text, chatHistory);
    } else {
      response = "I'm sorry, I can only process text messages and images at the moment.";
    }

    if (message.text) {
      userHistory.push({
        role: 'user',
        parts: [{ text: message.text }],
        timestamp: new Date().toISOString()
      });
    }

    userHistory.push({
      role: 'model',
      parts: [{ text: response }],
      timestamp: new Date().toISOString()
    });

    if (userHistory.length > 40) {
      userHistory.splice(0, userHistory.length - 40);
    }

    const answer = response;
    const MAX_MESSAGE_LENGTH = 1900; 

    let remainingAnswer = answer;
    while (remainingAnswer.length > 0) {
      const messagePart = remainingAnswer.substring(0, MAX_MESSAGE_LENGTH);
      await sendMessage(senderId, messagePart);
      remainingAnswer = remainingAnswer.substring(MAX_MESSAGE_LENGTH);
    }

  } catch (error) {
    console.error('Error handling message for senderId ', senderId, ':', error);
    await sendMessage(senderId, 'Sorry, I encountered an error processing your message. Please try again.');
  }
}

// HANDLE POSTBACK EVENTS
async function handlePostback(event, chatHistory) {
  const senderId = event.sender.id;
  const payload = event.postback.payload;

  let response;
  switch (payload) {
    case 'GET_STARTED':
      response = 'Hello! I\'m Hashia your personal AI companion. I can help you with questions and analyze images you send me. How can I assist you today? 😊';
      break;
    case 'CLEAR_HISTORY':
      chatHistory.delete(senderId);
      response = 'Your chat history has been cleared. How can I help you today?';
      break;
    case 'PINTEREST':
      response = 'Please enter what image you are looking for after /pinterest';
      break;
    default:
      response = 'I received your request. How can I help you?';
  }

  await sendMessage(senderId, response);
  await sendTypingOff(senderId);
}

// SERVE THE MAIN FRONTEND
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SERVE THE PRICACY POLICY & TERMS OF SERVICE FRONTEND
app.get('/privacy-policy-terms-of-service', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pptos.html'));
});

// SERVE THE PRIVACY POLICY FRONTEND FOR FACEBOOK DEVELOPERS LIVE SUPPORT
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'policy.html'));
});

// SERVE THE TERMS OF SERVICE FRONTEND FOR FACEBOOK DEVELOPERS LIVE
app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});


app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// START SERVER
(async () => {
  await loadSystemInstruction();
  app.listen(PORT, async () => {
    console.log(`🚀 Facebook Chatbot server is running on port ${PORT}`);
    console.log(`📝 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`💊 Health check: http://localhost:${PORT}/health`);
  
    // SETUP MESSENGER PROFILE
    await setupMessengerProfile();
  });
})();

process.on('SIGINT', async () => {
  console.log('📄 Saving chat history before shutdown...');

  try {
    const historyObject = Object.fromEntries(chatHistory);
    await fs.writeFile('./tmp/chat_history_backup.json', JSON.stringify(historyObject, null, 2));
    console.log('💾 Chat history saved successfully');
  } catch (error) {
    console.error('❌ Error saving chat history:', error);
  }

  process.exit(0);
});

module.exports = app;
