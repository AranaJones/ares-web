(function () {
    "use strict";

    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message');
    const usernameInput = document.getElementById('username');

    // Uses textContent only, so user text can never inject HTML.
    window.appendMsg = function (nick, text, nickClass) {
        const line = document.createElement('div');
        line.className = 'msg-line';

        const nickSpan = document.createElement('span');
        nickSpan.className = nickClass || 'nick-user';
        nickSpan.textContent = nick + ': ';

        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        line.append(nickSpan, textSpan);
        chatBox.appendChild(line);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    function send() {
        const text = messageInput.value.trim();
        if (!text || messageInput.disabled) return;
        const nick = usernameInput.value.trim() || 'AresUser';
        window.appendMsg(nick, text, 'nick-user');
        messageInput.value = '';
        messageInput.focus();
    }

    // Submitting the form covers both the Enter key and the Send button.
    chatForm.addEventListener('submit', function (event) {
        event.preventDefault();
        send();
    });
})();
