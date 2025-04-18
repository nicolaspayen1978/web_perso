//this is chatbot.js the frontend javascript code for the chatbot
//it is used in all pages with a chatbot 
let chatbox = null; // Declare globally


// Create BroadcastChannel creation ..
if (!window.chatChannel) {
    window.chatChannel = new BroadcastChannel("chat-sync");
}

// Alias for easier access
const chatChannel = window.chatChannel;

// Listen for messages from other tabs
chatChannel.onmessage = (event) => {
    console.log("📩 Received message from another tab:", event.data);
    displayChatHistory();
};

// Generate or retrieve visitor ID
function getVisitorID() {
    let visitorID = localStorage.getItem("visitorID");
    if (!visitorID) {
        visitorID = crypto.randomUUID();
        localStorage.setItem("visitorID", visitorID);
    }
    return visitorID;
}

 //function to save ChatHistory in local storage
function saveChatHistory(newChatHistory) {

    localStorage.setItem("chatHistory", JSON.stringify(newChatHistory)); // Fix: Ensure proper storage format
}

/// Frontend helper to send message to backend KV API
async function sendMessageToServer(role, content) {
  const visitorID = getVisitorID();
  const timestamp = Date.now();

  try {
    await fetch("/api/saveMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorID, sender: role, message: content, timestamp })
    });
  } catch (error) {
    console.error("❌ Error sending message to server:", error);
  }
}

 //function to get ChatHistory from local storage
function getChatHistory() {
    return JSON.parse(localStorage.getItem("chatHistory")) || []; // Load chat history
}

// Function to display chat history in the chatbox
function displayChatHistory() {
    const chatHistory = getChatHistory();

    if (!chatbox) {
        console.error("❌ Chatbox not found! Skipping message append.");
        return;
    }

    if (!Array.isArray(chatHistory)) {
        console.warn("⚠️ Chat history is missing or not an array. Initializing as empty.");
        chatHistory = []; // Ensure it's a valid array
    }

    chatbox.innerHTML = ""; // Clear chatbox

    chatHistory.forEach(msg => {
        if (!msg || typeof msg.content !== "string") {
            console.warn("⚠️ Skipping invalid message:", msg);
            return;
        }
        appendMessage(msg.role, msg.content); // Display the message
    });

    chatbox.scrollTop = chatbox.scrollHeight;
}

async function initializeNicoAI() {
    if (localStorage.getItem("nicoAI_initialized")) {
        console.log("🔄 NicoAI is already initialized. Skipping...");
        return;
    }
    const chatHistory = getChatHistory();
    const visitorID = getVisitorID();

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
        localStorage.setItem("nicoAI_initialized", "true"); // Mark as initialized
        
        if (data.message) {
            chatHistory.push({ role: "assistant", content: data.message });  // Save Init response
            saveChatHistory(chatHistory);  // Now this function exists
            displayChatHistory();  // Make sure chat history is updated
            sessionStorage.setItem("welcomeMessageSent", "true");
            // Broadcast message to all open pages
            chatChannel.postMessage({ role: "assistant", content: data.message });
        }

    } catch (error) {
        console.error("❌ Error initializing NicoAI:", error);
    }
}

// Function to format links properly as clickable HTML
function formatLinks(message) {
    if (!message || typeof message !== "string") {
        console.error("❌ Error: responseText is undefined or not a string");
        return message || "";  // Return original text or empty string
    }

    try {
        return message.replace(
            /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
            (match, title, url) => `🔗 <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`
        );
    } catch (error) {
        console.error("⚠️ Error formatting links:", error);
        return message; // Return the original text if replacement fails
    }
}

// function to force the refresh of the chatbox
function appendMessage(role, content) {
    if (!chatbox) {
        console.error("❌ Chatbox not found! Skipping message append.");
        return;
    }
    const formattedContent = formatLinks(content); // Apply link formatting
    const messageElement = document.createElement("p");

    const sender = role === "assistant" ? "🧠 NicoAI" : "You";
    messageElement.innerHTML = `<strong>${sender}:</strong> ${formattedContent}`;

    chatbox.appendChild(messageElement); // ✅ Append message properly to chatbox
    chatbox.scrollTop = chatbox.scrollHeight; // ✅ Auto-scroll to latest message
}

//Reduce ChatHistory to not overload OpenAI
//maxTokens for GTP is 4000
//maxTokens for o3 is 200 000
function truncateChatHistory(chatHistory, maxTokens=4000) {
    if (!Array.isArray(chatHistory)) {
        console.error("Error: chatHistory is not an array.");
        return [];  // Return an empty array if chatHistory is invalid
    }

    let truncatedHistory = [];
    let totalTokens = 0;

    for (let i = chatHistory.length - 1; i >= 0; i--) {
        if (!chatHistory[i] || typeof chatHistory[i].content !== "string") {
            console.warn(`Skipping invalid message at index ${i}`);
            continue;  // Skip messages that are not in the right format
        }

        let messageTokens = chatHistory[i].content.length / 4;  // Approximate token count
        if (totalTokens + messageTokens > maxTokens) break;

        totalTokens += messageTokens;
        truncatedHistory.unshift(chatHistory[i]);
    }

    return truncatedHistory;
}

// If the backend API for NicoAI is not yet initialized, then we initialize it.
if (!localStorage.getItem("nicoAI_initialized")) {  
    initializeNicoAI();  // Call the initialization function
    localStorage.setItem("nicoAI_initialized", "true"); // Prevent re-initialization
}

document.addEventListener("DOMContentLoaded", function () {
    chatbox = document.getElementById("chatbox"); // Ensure chatbox exists

    //not on chat.html
    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatPopup = document.getElementById("chat-popup");
    const maximizeChat = document.getElementById("maximize-chat");
    const closeChat = document.getElementById("close-chat");
    
    //in all pages even chat.html
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    // refresh chat history
    chatHistory = getChatHistory();

    //Make the chatbox visible to the user
    function showChat() {
        if (chatPopup){
            chatPopup.style.display = "flex";
            setTimeout(() => {
                chatPopup.style.opacity = "1";
                chatPopup.style.transform = "translateY(0)";
            }, 10);
            sessionStorage.setItem("showChat", "true");
        }
        displayChatHistory(); // Ensure chat history is displayed on open
    }

    async function initSessionChat() {
        if (!sessionStorage.getItem("welcomeMessageSent")) {
             const welcomeMessage = `👋 Hi! I'm NicoAI, the AI version of Nicolas Payen. How can I help you today?<br>
<span class="chat-note">Note: Nicolas will personally review this conversation later, so you can also use it to leave him a message. Your input will be stored and shared with him.</span>`;

            const chatHistory = getChatHistory();
            chatHistory.push({ role: "assistant", content: welcomeMessage });
            sessionStorage.setItem("welcomeMessageSent", "true");
            saveChatHistory(chatHistory); // Save message sent to user
            await sendMessageToServer("assistant", welcomeMessage); //Save message on the server side KV database
            //informed other open chat about the new message
            chatChannel.postMessage({
                role: "assistant",
                content: welcomeMessage
            });
        }
        //if the chat was opened on another page, then we open it automaticaly.
        if (sessionStorage.getItem("showChat")){
            showChat();
        }
        displayChatHistory();

    }

    //Make the chatbox invisible to the user
    function hideChat() {
        if(chatPopup) {
            chatPopup.style.opacity = "0";
            chatPopup.style.transform = "translateY(50px)";
            setTimeout(() => {
                chatPopup.style.display = "none";
            }, 300);
            sessionStorage.removeItem("showChat");
        }
    }

    if(chatPopup && chatbotIcon && closeChat && maximizeChat) {

        // Fix: Maximize button should open the full-page chat with history
        maximizeChat.addEventListener("click", function () {
            if (chatHistory.length === 0) {
                console.warn("No chat history to transfer!");
                return;
            }
            // Remove system messages before sending history to new tab
            //const filteredChatHistory = chatHistory.filter(msg => msg.role !== "system");
            //localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
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
    }

    document.addEventListener("click", function (event) {
        if(chatPopup && chatbotIcon){
            if (!chatPopup.contains(event.target) && !chatbotIcon.contains(event.target)) {
                hideChat();
            }
        }
    });

    document.addEventListener("touchstart", function (event) {
        if(chatPopup && chatbotIcon){
            if (!chatPopup.contains(event.target) && !chatbotIcon.contains(event.target)) {
                hideChat();
            }
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

   // Function to send user message and receive NicoAI response
    async function sendMessage() {
        let userText = userInput.value.trim();
        if (!userText) return;

        // Display user's message in the chatbox
        chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
        chatbox.scrollTop = chatbox.scrollHeight;
        userInput.value = ""; // Clear message input field

        // Update chat history and save it locally
        chatHistory.push({ role: "user", content: userText });
        saveChatHistory(chatHistory);
        await sendMessageToServer("user", userText); // Save to server (KV)
        chatChannel.postMessage({ role: "user", content: userText }); // Broadcast to other tabs

        // Truncate chat history to fit token limits
        chatHistory = truncateChatHistory(chatHistory, 100000);

        console.log("Sending request to API...");

        const visitorID = getVisitorID(); // Retrieve or generate visitor ID
        const previousMessages = getChatHistory(); // 🔄 NEW: Get full chat history

        // Once-per-day notification logic
        const today = new Date().toISOString().slice(0, 10); // Format: "YYYY-MM-DD"
        const lastNotificationDate = localStorage.getItem("lastNicoAINotified");

        let shouldNotify = false;
        if (lastNotificationDate !== today) {
            shouldNotify = true;
            localStorage.setItem("lastNicoAINotified", today); // Save today's date
        }

        // Include full context + notify flag in the request body
        const fullSentMessage = JSON.stringify({
            visitorID,
            userInput: userText,
            previousMessages,
            notifyToday: shouldNotify // ✅ Only true once per day
        });

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

            let botReply = typeof data.response === "string"
                ? data.response.trim()
                : "I'm sorry, I didn't understand that.";

            chatHistory.push({ role: "assistant", content: botReply });
            appendMessage("assistant", botReply);
            saveChatHistory(chatHistory); // Save assistant response
            await sendMessageToServer("nicoAI", botReply); // Save to server (KV)
            chatbox.scrollTop = chatbox.scrollHeight;

            // Broadcast assistant message to other open tabs
            chatChannel.postMessage({ role: "assistant", content: botReply });

        } catch (error) {
            console.error("Chatbot Error:", error);
            chatbox.innerHTML += `<p><strong>AI:</strong> Sorry, I encountered an error. Please try again.</p>`;
        }
    }

    //when the page load we initiate the chat session
    initSessionChat();
});