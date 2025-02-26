const chatbox = document.getElementById("chatbox");
const userInput = document.getElementById("user-input");

let chatHistory = [{ role: "system", content: "You are Nicolas Payen's AI assistant. Get to know the visitor. Help him with information about Nicolas Payen. Organise meeting or call." }];

async function sendMessage() {
    let userText = userInput.value.trim();
    if (!userText) return;

    chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
    userInput.value = "";

    chatHistory.push({ role: "user", content: userText });

    const response = await fetch("https://web-perso.vercel.app/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory })
    });

    const data = await response.json();
    let botReply = data.choices[0].message.content;

    chatHistory.push({ role: "assistant", content: botReply });

    chatbox.innerHTML += `<p><strong>AI:</strong> ${botReply}</p>`;
}