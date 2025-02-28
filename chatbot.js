// ✅ Load external resources (articles, resume, career, projects)
let resources = {};  // Store fetched resources
let chatHistory = [];  // ✅ Declare chatHistory globally at the top

async function fetchResources() {
    try {
        const response = await fetch("resources.json");
        if (!response.ok) throw new Error("Failed to load resources");
        resources = await response.json();
        console.log("Resources Loaded:", resources);
    } catch (error) {
        console.error("Error fetching resources:", error);
    }
}

// ✅ Fetch resources before anything else
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

    // ✅ Fix: Maximize button should open the full-page chat with history
    maximizeChat.addEventListener("click", function () {
        const chatHistoryEncoded = encodeURIComponent(JSON.stringify(chatHistory));
        const chatUrl = `chat.html?history=${chatHistoryEncoded}`;
        window.open(chatUrl, "_blank"); // ✅ Open chat in new tab
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
        You are a virtual assistant representing Nicolas Payen. 
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
            chatbox.scrollTop = chatbox.scrollHeight;
        } catch (error) {
            console.error("Chatbot Error:", error);
            chatbox.innerHTML += `<p><strong>AI:</strong> Sorry, I encountered an error. Please try again.</p>`;
        }
    }
});