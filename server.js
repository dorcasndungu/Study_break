const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let players = {};
let food = { x: Math.floor(Math.random() * 30) * 20, y: Math.floor(Math.random() * 20) * 20 };
let playerCount = 0;

io.on('connection', (socket) => {
    if (playerCount >= 4) {
        socket.emit('full', 'Game is full!');
        socket.disconnect();
        return;
    }

    playerCount++;
    console.log('Player connected:', socket.id);

    // Initialize player with 5-segment snake
    let startX = 100 + playerCount * 100;
    players[socket.id] = {
        x: startX,
        y: 200,
        direction: 'right',
        segments: [
            { x: startX, y: 200 },
            { x: startX - 20, y: 200 },
            { x: startX - 40, y: 200 },
            { x: startX - 60, y: 200 },
            { x: startX - 80, y: 200 }
        ],
        score: 10,
        color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][playerCount - 1] // Red, Green, Blue, Yellow
    };

    // Send initial state to new player
    socket.emit('init', { id: socket.id, players, food });

    // Broadcast to all players
    io.emit('update', { players, food });

    socket.on('move', (direction) => {
        if (['up', 'down', 'left', 'right'].includes(direction)) {
            players[socket.id].direction = direction;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        playerCount--;
        io.emit('update', { players, food });
    });
});

// Game loop (200ms ticks)
setInterval(() => {
    for (let id in players) {
        let player = players[id];
        let head = { x: player.segments[0].x, y: player.segments[0].y };

        // Move head based on direction
        if (player.direction === 'up') head.y -= 20;
        if (player.direction === 'down') head.y += 20;
        if (player.direction === 'left') head.x -= 20;
        if (player.direction === 'right') head.x += 20;

        // Wall collision
        if (head.x < 0 || head.x >= 600 || head.y < 0 || head.y >= 400) {
            player.score -= 1;
            head.x = Math.max(0, Math.min(580, head.x)); // Bounce back
            head.y = Math.max(0, Math.min(380, head.y));
        }

        // Snake collision
        for (let otherId in players) {
            if (otherId !== id) {
                players[otherId].segments.forEach(seg => {
                    if (head.x === seg.x && head.y === seg.y) {
                        player.score -= 1;
                        head.x = player.segments[0].x; // Reset to last position
                        head.y = player.segments[0].y;
                    }
                });
            }
        }

        // Food collision
        if (head.x === food.x && head.y === food.y) {
            player.score += 5;
            food = { x: Math.floor(Math.random() * 30) * 20, y: Math.floor(Math.random() * 20) * 20 };
            io.emit('foodUpdate', food);
        }

        // Update segments (fixed 5 length)
        player.segments.unshift(head);
        if (player.segments.length > 5) player.segments.pop();
    }
    io.emit('update', { players, food });
}, 200); // 200ms = moderate pace

server.listen(3000, () => console.log('Server running on port 3000'));