// Load external resources (articles, resume, career, projects)
let resources = {};  // Store fetched resources

async function fetchResources() {
    try {
        const response = await fetch("resources.json");

        if (!response.ok) {
            throw new Error(`Failed to load resources: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        console.log("Raw JSON response:", text);

        const json = JSON.parse(text); // Use JSON.parse to catch errors
        console.log("Resources Loaded:", json);

        resources = json; // Store the resources properly
    } catch (error) {
        console.error("Error fetching resources:", error);
    }
}

// Fetch resources before anything else
document.addEventListener("DOMContentLoaded", async function () {
    await fetchResources();  // Load `resources.json`
});

document.addEventListener("DOMContentLoaded", function () {
    const chatbox = document.getElementById("chatbox");
    const chatbotIcon = document.getElementById("chatbot-icon");
    const chatPopup = document.getElementById("chat-popup");
    const maximizeChat = document.getElementById("maximize-chat");
    const closeChat = document.getElementById("close-chat");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || []; // Load chat history

    function displayChatHistory() {
        chatbox.innerHTML = ""; // Clear chatbox
        chatHistory.forEach(msg => {
            const sender = msg.role === "assistant" ? "🤖 NicoAI" : "You";
            chatbox.innerHTML += `<p><strong>${sender}:</strong> ${msg.content}</p>`;
        });
    }

    function saveChatHistory() {
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory)); // Save chat history
    }

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

    function hideChat() {
        chatPopup.style.opacity = "0";
        chatPopup.style.transform = "translateY(50px)";
        setTimeout(() => {
            chatPopup.style.display = "none";
        }, 300);
    }

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


    async function getSystemMessage() {
        return `
        You are a NicoAI the AI version of Nicolas Payen. You are also his AI assistant.
        Here is what you know about him:

        **Birthday:** March 11, 1978, born in Valence, France  
        **Location:** Lives in Naarden, Netherlands  
        **Expertise:** Investment, finance, digital transformation, energy transition, climate tech, entrepreneurship  
        **Family:** Married to Eveline Noya, Dutch citizen and senior HR professional. Two kids: Floris (born 2012) and Romy (born 2016).   

        **Strengths:** Deep knowledge in clean technologies, climate investments, international business, strategic leadership.  
        **Weaknesses:** Sometimes overanalyzes decisions, prefers calculated risk, needs data to act.  

        **Career Timeline:** ${resources.career || "Loading..."}  
        **Resume:** ${resources.resume || "Loading..."}  

        **Articles:**  
        ${resources.articles ? resources.articles.map(article => `- [${article.title}](${article.url})`).join("\n") : "Loading..."}

        **Projects:**  
        ${resources.projects ? resources.projects.map(project => `- [${project.title}](${project.url})`).join("\n") : "Loading..."}

        **Contacts:** ${resources.contact || "Loading..."}

        Provide links when relevant. Always share a little summary of the content of the link before doing so. 
        If a user asks for more information, share these sources.
        Help visitors book meetings or calls with Nicolas Payen using Calendly.
    `;
    }

    async function sendMessage() {
        let userText = userInput.value.trim();
        if (!userText) return;

        chatbox.innerHTML += `<p><strong>You:</strong> ${userText}</p>`;
        chatbox.scrollTop = chatbox.scrollHeight; 
        userInput.value = "";

        if (Object.keys(resources).length === 0) {
            chatbox.innerHTML += `<p><strong>AI:</strong> Please wait, loading resources...</p>`;
            await fetchResources();
        }

        let systemMessage = await getSystemMessage();
        
        chatHistory = [{ role: "system", content: systemMessage }];
        chatHistory.push({ role: "user", content: userText });

        saveChatHistory(); // Save user input

        chatHistory = truncateChatHistory(chatHistory, 4000);

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
            let botReply = data.choices[0]?.message?.content || "I'm sorry, I didn't understand that.";

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