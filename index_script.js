const LAMBDA_URL = 'https://bfkd6bmkiwaygprwmbqoptxyh40iycad.lambda-url.ap-south-1.on.aws';

let sessionId = null;

document.addEventListener('DOMContentLoaded', () => {

    const birthDateInput = document.getElementById('birthDate');
    const calendarIcon = document.querySelector('.calendar-icon');
    const formContainer = document.getElementById('formContainer');
    const chatbox = document.getElementById('chatbox');
    const form = document.getElementById('birthChartForm');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusElement = document.getElementById('status-message');

    const today = new Date().toISOString().split('T')[0];
    birthDateInput.setAttribute('max', today);

    calendarIcon.addEventListener('click', () => {
        if (birthDateInput.showPicker) birthDateInput.showPicker();
        else birthDateInput.focus();
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        if (!this.checkValidity()) {
            this.reportValidity();
            return;
        }
        try {
            statusElement.textContent = "Generating your Kundli...";
            statusElement.style.color = 'blue';

            const formData = new FormData(this);
            // Remove email from submission temporarily if needed
            formData.delete('email');
            
            const response = await fetch(`${LAMBDA_URL}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(formData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            sessionId = data.sessionId;

            formContainer.style.display = 'none';
            chatbox.style.display = 'flex';
            chatbox.classList.add('active');
            chatbox.focus();

            statusElement.textContent = "";
            addMessage(data.message, 'assistant');
            this.reset();
        } catch (error) {
            statusElement.innerHTML = `Error: ${error.message}`;
            statusElement.style.color = 'red';
            console.error('Submission Error:', error);
        }
    });

    const addChatMessage = (message, fromUser  = true) => {
        const messageElem = document.createElement('div');
        messageElem.textContent = message;
        messageElem.style.padding = '8px 12px';
        messageElem.style.margin = '6px 0';
        messageElem.style.borderRadius = '12px';
        messageElem.style.maxWidth = '80%';
        messageElem.style.wordWrap = 'break-word';
        if (fromUser ) {
            messageElem.style.backgroundColor = '#667eea';
            messageElem.style.color = 'white';
            messageElem.style.alignSelf = 'flex-end';
        } else {
            messageElem.style.backgroundColor = '#ddd';
            messageElem.style.color = '#333';
            messageElem.style.alignSelf = 'flex-start';
        }
        chatMessages.appendChild(messageElem);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text || !sessionId) return;

        try {
            addChatMessage(text, true);
            chatInput.value = '';

            const response = await fetch(`${LAMBDA_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, message: text })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Chat error: ${errorText}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            addChatMessage(data.reply, 'assistant');
        } catch (error) {
            addChatMessage("Sorry, there was an error processing your message.", 'assistant');
            console.error('Chat Error:', error);
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const prompt = e.target.dataset.prompt;
            if (!sessionId) return;

            try {
                addChatMessage(prompt, 'user');
                const response = await fetch(`${LAMBDA_URL}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, message: prompt })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Chat error: ${errorText}`);
                }

                const data = await response.json();
                addChatMessage(data.reply, 'assistant');
            } catch (error) {
                addChatMessage("Sorry, there was an error processing your request.", 'assistant');
                console.error('Topic Error:', error);
            }
        });
    });
});
