(() => {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('message');
    const output = document.getElementById('chat-box');
    const nickname = document.getElementById('username');
    const status = document.getElementById('connectionStatus');
    const history = [];
    let roomName = '';

    function appendMessage(name, text, system = false) {
        const line = document.createElement('p');
        line.className = system ? 'message system' : 'message';
        if (system) {
            line.textContent = text;
        } else {
            const author = document.createElement('strong');
            author.textContent = `${name}: `;
            line.append(author, document.createTextNode(text));
        }
        output.append(line);
        output.scrollTop = output.scrollHeight;
    }

    document.addEventListener('ares-room-selected', (event) => {
        roomName = event.detail.name;
        history.length = 0;
        output.replaceChildren();
        appendMessage('System', `You selected ${roomName}. Messages are sent through the configured chat service.`, true);
        input.focus();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        const nick = nickname.value.trim().slice(0, 40) || 'AresUser';
        appendMessage(nick, text);
        input.value = '';
        input.disabled = true;
        form.querySelector('button').disabled = true;
        status.textContent = 'Waiting for chat service…';
        history.push({ role: 'user', content: text });
        if (roomName && history.length === 1) {
            history.unshift({ role: 'system', content: `The user is chatting in the ${roomName} room.` });
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error?.message || 'Chat request failed.');
            if (typeof result.reply !== 'string') throw new Error('The chat service returned an invalid response.');
            history.push({ role: 'assistant', content: result.reply });
            appendMessage('Ares', result.reply);
            status.textContent = 'Chat service connected.';
        } catch (error) {
            history.pop();
            appendMessage('System', error.message, true);
            status.textContent = 'Unable to reach chat service.';
        } finally {
            input.disabled = false;
            form.querySelector('button').disabled = false;
            input.focus();
        }
    });
})();
