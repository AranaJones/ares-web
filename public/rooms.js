(() => {
    const list = document.getElementById('rooms-list');
    const selected = document.getElementById('selected-room');
    const notice = document.getElementById('notice');

    function showMessage(text) {
        const message = document.createElement('p');
        message.textContent = text;
        list.replaceChildren(message);
    }

    async function fetchRooms() {
        list.textContent = 'Loading rooms…';
        try {
            const response = await fetch('/api/rooms');
            if (!response.ok) throw new Error('Room directory request failed.');
            const result = await response.json();
            if (!Array.isArray(result.rooms) || result.rooms.length === 0) {
                showMessage('No rooms are available.');
                return;
            }

            const fragment = document.createDocumentFragment();
            for (const room of result.rooms) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'room';
                const name = document.createElement('span');
                name.textContent = room.name;
                const count = document.createElement('span');
                count.textContent = String(room.users ?? 0);
                button.append(name, count);
                button.addEventListener('click', () => {
                    list.querySelectorAll('.room').forEach((item) => item.removeAttribute('aria-current'));
                    button.setAttribute('aria-current', 'true');
                    selected.textContent = `Room: ${room.name}`;
                    document.dispatchEvent(new CustomEvent('ares-room-selected', { detail: { name: room.name } }));
                });
                fragment.append(button);
            }
            list.replaceChildren(fragment);
            notice.textContent = result.stale ? 'Showing cached room data; refresh is unavailable.' : '';
        } catch {
            showMessage('Could not load rooms. Try refreshing.');
        }
    }

    document.getElementById('refresh-rooms').addEventListener('click', fetchRooms);
    fetchRooms();
})();
