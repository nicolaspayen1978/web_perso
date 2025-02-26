const chatbox = document.getElementById("chatbox");
const userInput = document.getElementById("user-input");

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
