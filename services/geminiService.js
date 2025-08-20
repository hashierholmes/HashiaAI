const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { sendMessage, sendImage } = require('./services/messengerApi');

let systemInstruction = '';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

async function loadSystemInstruction() {
  try {
    systemInstruction = await fs.readFile(path.join(__dirname, 'systemInstruction', 'prompt.txt'), 'utf8');
    console.log('System instruction loaded successfully.');
  } catch (error) {
    console.error('Error loading system instruction:', error);
    process.exit(1);
  }
}

// DOWNLOAD IMAGE FROM FACEBOOK AND CONVERT TO BASE64
async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${config.FACEBOOK_PAGE_ACCESS_TOKEN}`
      }
    });

    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

// HANDLE TEXT MESSAGES WITH GEMINI AI
async function handleTextMessage(senderId, text, chatHistory) {
  try {
    const userHistory = chatHistory.get(senderId) || [];

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const chat = model.startChat({
      history: userHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }))
    });

    const result = await chat.sendMessage(text);
    const response = await result.response;

    return response.text().replace(/\*{1,3}/g, '');

  } catch (error) {
    console.error('Error with Gemini text processing:', error);
    return 'I apologize, but I\'m having trouble processing your message right now. Please try again later.';
  }
}

// HANDLE IMAGE MESSAGES WITH GEMINI AI
async function handleImageMessage(senderId, imageAttachments, text = '', chatHistory) {
  try {
    const userHistory = chatHistory.get(senderId) || [];

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
      }
    });

    const imageUrl = imageAttachments[0].payload.url;
    const imageData = await downloadImage(imageUrl);
    const parts = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData
        }
      }
    ];

    if (text.trim()) {
      parts.push({ text: text });
    } else {
      parts.push({ text: 'What do you see in this image? Please describe it in detail.' });
    }

    const chat = model.startChat({
      history: userHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }))
    });

    const result = await chat.sendMessage(parts);
    const response = await result.response;

    userHistory.push({
      role: 'user',
      parts: parts,
      timestamp: new Date().toISOString()
    });

    return response.text().replace(/\*{1,3}/g, '');

  } catch (error) {
    console.error('Error with Gemini image processing:', error);
    return 'I apologize, but I\'m having trouble analyzing the image you sent. Please try sending it again or describe what you\'d like me to help you with.';
  }
}

module.exports = {
  loadSystemInstruction,
  handleTextMessage,
  handleImageMessage,
  downloadImage
};
