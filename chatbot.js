const chatbox = document.getElementById("chatbox");
const userInput = document.getElementById("user-input");

document.addEventListener("DOMContentLoaded", function () {
    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatPopup = document.getElementById("chat-popup");
    const closeChat = document.getElementById("close-chat");

    function showChat() {
        chatPopup.style.display = "flex"; // Show chat
        setTimeout(() => {
            chatPopup.style.transform = "translateY(0)"; // Ensure animation works
        }, 10);
    }

    function hideChat() {
        chatPopup.style.transform = "translateY(50px)"; // Slide down before hiding
        setTimeout(() => {
            chatPopup.style.display = "none";
        }, 300);
    }

    chatbotIcon.addEventListener("click", function () {
        showChat();
    });

    closeChat.addEventListener("click", function () {
        //hideChat();
    });

    // Ensure tapping outside chatbox on iPhone closes it
    document.addEventListener("click", function (event) {
        if (!chatPopup.contains(event.target) && !chatbotIcon.contains(event.target)) {
            //hideChat();
        }
    });
});

async function sendMessage() {
    let userText = userInput.value.trim();
    if (!userText) return;

    chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
    userInput.value = "";

    const currentTime = new Date().toLocaleTimeString("en-US", { timeZone: "Europe/Amsterdam" });
    chatHistory.push({ role: "user", content: `User asked: "${userText}". Current time in Amsterdam is ${currentTime}.` });

    try {
        const response = await fetch("https://web-perso.vercel.app/api/chatbot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("Invalid response from API");
        }

        let botReply = data.choices[0].message.content;
        chatHistory.push({ role: "assistant", content: botReply });

        chatbox.innerHTML += `<p><strong>AI:</strong> ${botReply}</p>`;
    } catch (error) {
        console.error("Chatbot Error:", error);
        chatbox.innerHTML += `<p><strong>AI:</strong> Sorry, I encountered an error. Please try again.</p>`;
    }
}
