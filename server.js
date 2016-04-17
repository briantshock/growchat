var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var roomList = [ 'Global' ];
var connectedUsers = {};

var database = require('./database');

// Create node.js server and serve index page on connecting
app.get('/', function(req,res) {
	res.sendFile(__dirname + '/index.html');
});

app.use(function(req, res) {
	res.redirect('/');	
});

server.listen(9000, function() {
	console.log('Brian\'s Grow Chat Server listening on port 9000.');
});

// Set up server socket and socket event listeners

io.on('connection', function(socket){
	socket.on('disconnect', function(){
		userDisconnected(socket.id);
	});
	
	socket.on('User Entered Message', serverReceivedMessage);
	socket.on('User Sends Private Message', sendPrivateMessage);
	socket.on('User Creates Room', createRoom);
	socket.on('User Connected To Room', userConnected);
	socket.on('User Requests Room List', getFullRoomList);
	socket.on('User Requests User List', getRoomUserList);
	socket.on('User Requests Room History', getRoomHistory);
	socket.on('User Searches Room History', searchRoomHistory);
});

// When the 
serverReceivedMessage = function(message) {
	this.broadcast.to(message.recipient).emit('Received Message', message);

	database.logMessage(this, message, message.recipient);
};

sendPrivateMessage = function(message) {	
	this.broadcast.to(message.recipient).emit('Received Private Message', message);
}

createRoom = function(room) {
	roomList.push(room.name);

	this.broadcast.emit('Room Added', room.name);
};

var userConnected = function(connection) {	
	if (connection && connection.user) {
		registerUser(this.id, connection.user);
		
		console.log(connection.user.name + " connected to room: " + connection.room);
		
		this.join(connection.room);				
		
		for (var room in this.rooms) {						
			if (room != connection.room && room != this.id) {				
				this.leave(room);
				
				this.broadcast.to(room).emit('Room User List Updated', roomUserList(room));				
			}
		}				
		
		this.broadcast.to(connection.room).emit('Room User List Updated', roomUserList(connection.room));
	}
}

var registerUser = function(socketId, user)  {
	if (!(socketId in connectedUsers)) {
		
		user.token = socketId;
		
		connectedUsers[socketId] = user;
		
		console.log("registering " + socketId + " as " + user.name);
	}
}

var userDisconnected = function(socketId) {
	console.log(socketId + " disconnected.");
	
	delete connectedUsers[socketId];
	
	io.emit('User Disconnected', socketId);
}


var getRoomUserList = function(room) {		
	this.emit('Room User List', roomUserList(room));
}

var getFullRoomList = function() {	
	this.emit('Send Full Room List', roomList);
}

var getRoomHistory = function(room) {	
	getHistory(this, [ room ]);
}

var searchRoomHistory = function(filterItems) {		
	getHistory(this, [ filterItems.room, filterItems.text])
}

// Helper functions

var roomUserList = function(room) {
	var roomUserList = [];
	
	if (io.sockets.adapter.rooms[room]) {
		for (var socket in io.sockets.adapter.rooms[room].sockets) {
			roomUserList.push(connectedUsers[socket]);
		}
	}
	
	return roomUserList;
}

var getHistory = function(socket, filterArgs) {
	var PythonShell = require("python-shell");
	
	var options = {
	  mode: 'json',
	  pythonOptions: ['-u'],
	  scriptPath: __dirname + '/',
	  args: filterArgs
	};
	
    var shell = new PythonShell('roomhistory.py', options);
    
	var results = [];
	
	shell.on('message', function (message){
		results.push(message);
	});  
	
	shell.end(function (err) {
		if (err) {
			throw err;
		}				
		
		socket.emit('Send Room History', results);
	});	
}
