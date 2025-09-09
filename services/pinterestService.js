const axios = require('axios');
const { sendMessage, sendImage, sendTypingOff } = require('./messengerApi');

// HANDLE PINTEREST
async function handlePinterest(senderId, messageText) {
    const input = messageText.trim().split(' ').slice(1); // Remove '/pinterest'

    if (!input.length) {
        await sendMessage(senderId, 'Please enter what image you are looking for after /pinterest');
        return;
    }

    try {
        const prompt = input.join(" ");
        const res = await axios.get(`https://hashia-pinterest.vercel.app/api?search=${encodeURIComponent(prompt)}`);
        const content = res.data.data;

        const uniqueUrls = [...new Set(content)].slice(0, 10);

        if (uniqueUrls.length === 0) {
            await sendMessage(senderId, 'No images found for the given search term.');
            return;
        }

        await sendMessage(senderId, "Please wait while sending the images...");
        await sendImage(senderId, uniqueUrls);
        await sendTypingOff(senderId);
    } catch (error) {
        console.error("Error in pinterest command:", error);
        await sendMessage(senderId, "Something went wrong while fetching images.");
    }
}

module.exports = {
  handlePinterest
};
