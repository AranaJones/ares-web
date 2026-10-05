(function () {
    'use strict';

    const list = document.getElementById('rooms-list');

    function message(text) {
        const div = document.createElement('div');
        div.style.cssText = 'padding:15px; text-align:center; color:#888; font-style:italic;';
        div.textContent = text;
        return div;
    }

    function render(data) {
        list.replaceChildren();
        const rooms = Array.isArray(data.rooms) ? data.rooms : [];
        if (data.stale) list.appendChild(message('Directory may be out of date (index unreachable)'));
        if (!rooms.length) list.appendChild(message('No rooms available'));
        rooms.forEach(function (room) {
            const btn = document.createElement('button');
            btn.className = 'channel-row';
            const name = document.createElement('span');
            name.textContent = '# ' + room.name;
            const count = document.createElement('span');
            count.className = 'user-counter';
            count.textContent = '[' + (room.users != null ? room.users : '?') + ']';
            btn.append(name, ' ', count);
            btn.title = [room.topic, room.language].filter(Boolean).join(' - ');
            btn.addEventListener('click', function () {
                if (typeof window.connectToRoom === 'function') {
                    window.connectToRoom(room.ip, room.port, room.name);
                }
            });
            list.appendChild(btn);
        });
    }

    window.fetchLiveRooms = function () {
        list.replaceChildren(message('Fetching live data...'));
        fetch('/api/rooms')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(render)
            .catch(function () {
                list.replaceChildren(message('Could not load room directory'));
            });
    };

    window.fetchLiveRooms();
})();
