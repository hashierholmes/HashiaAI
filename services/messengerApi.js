const axios = require('axios');
const config = require('../config');

// SEND MESSAGE TO FACEBOOK MESSENGER
async function sendMessage(recipientId, message) {
  const messageData = {
    recipient: { id: recipientId },
    message: { text: message }
  };

  try {
    const response = await axios.post(
      `${config.GRAPH_API_URL}/me/messages`,
      messageData,
      {
        params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// SEND IMAGE BACK TO FACEBOOK MESSENGER
async function sendImage(senderId, imageUrls) {
    const attachments = imageUrls.map((url) => ({
        type: 'image',
        payload: {
            url: url,
            is_reusable: false
        }
    }));

    try {
        await axios.post(`${config.GRAPH_API_URL}/me/messages`, {
            messaging_type: 'RESPONSE',
            recipient: { id: senderId },
            message: { attachments }
        }, {
            params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN }
        });
        console.log(`Sent ${imageUrls.length} images to ${senderId}`);
    } catch (error) {
        console.error('Error sending image:', error.response?.data || error.message);
        throw error;
    }
}

// SEND TYPING INDICATOR ON
async function sendTypingOn(recipientId) {
  try {
    await axios.post(
      `${config.GRAPH_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        sender_action: 'typing_on'
      },
      {
        params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error sending typing indicator:', error);
  }
}

// SEND TYPING INDICATOR OFF
async function sendTypingOff(recipientId) {
  try {
    await axios.post(
      `${config.GRAPH_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        sender_action: 'typing_off'
      },
      {
        params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error sending typing indicator:', error);
  }
}

// SETUP PERSISTENT MENU AND GET STARTED BUTTON
async function setupMessengerProfile() {
  try {
    await axios.post(
      `${config.GRAPH_API_URL}/me/messenger_profile`,
      {
        get_started: { payload: 'GET_STARTED' }
      },
      {
        params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    await axios.post(
      `${config.GRAPH_API_URL}/me/messenger_profile`,
      {
        persistent_menu: [
          {
            locale: 'default',
            composer_input_disabled: false,
            call_to_actions: [
              {
                title: 'Pinterest',
                type: 'postback',
                payload: 'PINTEREST'
              },
              {
                title: 'Clear Chat History',
                type: 'postback',
                payload: 'CLEAR_HISTORY'
              }
            ]
          }
        ]
      },
      {
        params: { access_token: config.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('Messenger profile setup completed');
  } catch (error) {
    console.error('Error setting up messenger profile:', error.response?.data || error.message);
  }
}

module.exports = {
  sendMessage,
  sendImage,
  sendTypingOn,
  sendTypingOff,
  setupMessengerProfile
};
