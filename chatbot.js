// this is chatbot.js the frontend javascript code for the chatbot
// Load external resources (articles, resume, career, projects)

async function initializeNicoAI() {
    const visitorID = localStorage.getItem("visitorID") || crypto.randomUUID();
    localStorage.setItem("visitorID", visitorID);

    try {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorID })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ NicoAI Initialized:", data);
    } catch (error) {
        console.error("❌ Error initializing NicoAI:", error);
    }
}

// Run initialization when the page loads if not already initiated
document.addEventListener("DOMContentLoaded", function () {
    if (!sessionStorage.getItem("nicoAI_initialized")) {
        initializeNicoAI();
        sessionStorage.setItem("nicoAI_initialized", "true"); // Prevent re-initialization
    }
});

// Function to update progress text or bar
function updateProgress(percent) {
    const textElement = document.getElementById("loading-progress");
    const progressBar = document.getElementById("progress-bar");

    if (textElement) {
        textElement.innerText = `Loading ${percent}%...`;
    }

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.innerText = `${percent}%`;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const chatbox = document.getElementById("chatbox");
    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatPopup = document.getElementById("chat-popup");
    const maximizeChat = document.getElementById("maximize-chat");
    const closeChat = document.getElementById("close-chat");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    //retrieve chatHistory from local storage
    let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || []; // Load chat history

    //function to display ChatHistory in the chatbox
    function displayChatHistory() {
        chatbox.innerHTML = ""; // Clear chatbox
        chatHistory.forEach(msg => {
            const sender = msg.role === "assistant" ? "🤖 NicoAI" : "You";
            chatbox.innerHTML += `<p><strong>${sender}:</strong> ${msg.content}</p>`;
        });
    }

    //function to save ChatHistory in local storage
    function saveChatHistory() {
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory)); // Save chat history
    }

    //Make the chatbox visible to the user
    function showChat() {
        chatPopup.style.display = "flex";
        setTimeout(() => {
            chatPopup.style.opacity = "1";
            chatPopup.style.transform = "translateY(0)";
        }, 10);

        displayChatHistory(); // Load previous messages when opening chat

        // Check if welcome message has been sent in this session
        if (!sessionStorage.getItem("welcomeMessageSent")) {
            chatbox.innerHTML += `<p><strong>🤖 NicoAI:</strong> 👋 Hi! I'm NicoAI, the AI version of Nicolas Payen. How can I help you today?</p>`;
            sessionStorage.setItem("welcomeMessageSent", "true"); // Store flag so it doesn't repeat
        }
    }

    //Make the chatbox invisible to the user
    function hideChat() {
        chatPopup.style.opacity = "0";
        chatPopup.style.transform = "translateY(50px)";
        setTimeout(() => {
            chatPopup.style.display = "none";
        }, 300);
    }

    //Reduce ChatHistory to not overload OpenAI
    function truncateChatHistory(chatHistory, maxTokens = 4000) {
        let totalTokens = 0;
        let truncatedHistory = [];

        for (let i = chatHistory.length - 1; i >= 0; i--) {
            let messageTokens = chatHistory[i].content.length / 4;  // Approximate token count
            if (totalTokens + messageTokens > maxTokens) break;
            totalTokens += messageTokens;
            truncatedHistory.unshift(chatHistory[i]);
        }

        return truncatedHistory;
    }

    // Fix: Maximize button should open the full-page chat with history
    maximizeChat.addEventListener("click", function () {
        if (chatHistory.length === 0) {
            console.warn("No chat history to transfer!");
            return;
        }
        // Remove system messages before sending history to new tab
        //const filteredChatHistory = chatHistory.filter(msg => msg.role !== "system");
        sessionStorage.setItem("chatHistory", JSON.stringify(chatHistory));
        window.open("chat.html", "_blank");
    });

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

    sendButton.addEventListener("click", function () {
        sendMessage();
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    //function to send message in OpenAI
    async function sendMessage() {
        let userText = userInput.value.trim();
        if (!userText) return;

        //Update chat with the input from the user
        chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
        chatbox.scrollTop = chatbox.scrollHeight; 
        userInput.value = ""; //clear message field

        if (Object.keys(resources).length === 0) {
            chatbox.innerHTML += `<p><strong>AI:</strong> Please wait, loading resources...</p>`;
            await fetchResources();
        }

        chatHistory.push({ role: "user", content: userText });

        saveChatHistory(); // Save user input

        //make sure chatHistory no longer than 4000 words
        chatHistory = truncateChatHistory(chatHistory, 4000);

        console.log("Sending request to API...");

        const visitorID = getVisitorID(); // Ensure visitorID is sent

        const fullSentMessage = JSON.stringify({ visitorID, userInput: userText });
        console.log("Messages being sent:", fullSentMessage);

        try {
            const response = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: fullSentMessage
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            let botReply = data.response || "I'm sorry, I didn't understand that.";

            chatHistory.push({ role: "assistant", content: botReply });
            chatbox.innerHTML += `<p><strong>AI:</strong> ${botReply}</p>`;

            saveChatHistory(); // Save bot response
            chatbox.scrollTop = chatbox.scrollHeight;
        } catch (error) {
            console.error("Chatbot Error:", error);
            chatbox.innerHTML += `<p><strong>AI:</strong> Sorry, I encountered an error. Please try again.</p>`;
        }
    }
});