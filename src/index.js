const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const socketio = require('socket.io');
const {
    generateMessage,
    generateLocationMessage,
} = require('./utils/messages');
const {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom,
} = require('./utils/users');

const app = express();

const server = http.createServer(app);
const io = socketio(server);
const Filter = require('bad-words');

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));
app.use(cors());

io.on('connection', (socket) => {
    console.log('New websocket connection');

    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit('message', generateMessage('Admin', 'Welcome!')); // emit to specific client-group
        socket.broadcast
            .to(user.room)
            .emit(
                'message',
                generateMessage(
                    user.username,
                    `${user.username} has joined ${user.room}`
                )
            ); // send to everyone besides curr-socket

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room),
        });

        callback();
    });

    socket.on('sendMsg', (userMsg, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();
        if (filter.isProfane(userMsg)) {
            return callback('Profanity is not allowed!');
        }
        io.to(user.room).emit(
            'message',
            generateMessage(user.username, userMsg)
        ); // emit to all clients
        callback();
    });

    socket.on('sendLocation', (userLocation, callback) => {
        const user = getUser(socket.id);
        const url = `https://google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`;
        io.to(user.room).emit(
            'locationMessage',
            generateLocationMessage(user.username, url)
        );
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit(
                'message',
                generateMessage('Admin', `${user.username} has left`)
            );
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room),
            });
        }
    });
});

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
