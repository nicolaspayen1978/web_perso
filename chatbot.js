document.addEventListener("DOMContentLoaded", function () {
    const chatbox = document.getElementById("chatbox");
    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatPopup = document.getElementById("chat-popup");
    const closeChat = document.getElementById("close-chat");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    let chatHistory = [
        { role: "system", content: `
        You are a virtual assistant representing Nicolas Payen. 
        You know his expertise in investment, climate tech, and finance.
        
        Strengths: Deep knowledge in clean technologies, climate investments, international business, strategic leadership.
        Weaknesses: Sometimes overanalyzes decisions, prefers calculated risk, needs data to act.
        
        Answer all questions in a way that reflects Nicolas Payen's thinking and expertise.
        Help visitors book meetings or calls with Nicolas Payen using Calendly: [Calendly](https://calendly.com/nicolas_payen/30min).
    `}
    ];

    function showChat() {
        chatPopup.style.display = "flex";
        setTimeout(() => {
            chatPopup.style.opacity = "1";
            chatPopup.style.transform = "translateY(0)";
        }, 10);
    }

    function hideChat() {
        chatPopup.style.opacity = "0";
        chatPopup.style.transform = "translateY(50px)";
        setTimeout(() => {
            chatPopup.style.display = "none";
        }, 300);
    }

    chatbotIcon.addEventListener("click", function (event) {
        event.stopPropagation();
        if (chatPopup.style.display === "none" || chatPopup.style.display === "") {
            showChat();
        }
    });

    closeChat.addEventListener("click", function (event) {
        event.stopPropagation();
        hideChat();
    });

    chatPopup.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function (event) {
        if (!chatPopup.contains(event.target) && !chatbotIcon.contains(event.target)) {
            hideChat();
        }
    });

    document.addEventListener("touchstart", function (event) {
        if (!chatPopup.contains(event.target) && !chatbotIcon.contains(event.target)) {
            hideChat();
        }
    });

    // **Ensure Send Button Works**
    sendButton.addEventListener("click", function () {
        sendMessage();
    });

    // **Allow Enter Key to Work**
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    // **Ensure Send Message Works**
    async function sendMessage() {
        let userText = userInput.value.trim();
        if (!userText) return;

        chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
        chatbox.scrollTop = chatbox.scrollHeight; // Auto-scroll down
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
            chatbox.scrollTop = chatbox.scrollHeight; // Auto-scroll down
        } catch (error) {
            console.error("Chatbot Error:", error);
            chatbox.innerHTML += `<p><strong>AI:</strong> Sorry, I encountered an error. Please try again.</p>`;
        }
    }
});