/**	
	Grow Chat Server
	
	Brian Sciacchitano
*/

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var roomList = [ 'Global' ];
var connectedUsers = {};

var database = require('./database');

// Create node.js server and serve index page on connecting. Redirect all traffic to this
// base page.
app.get('/', function(req,res) {
	res.sendFile(__dirname + '/index.html');
});

app.use(function(req, res) {
	res.redirect('/');	
});

server.listen(8080, function() {
	console.log('Brian\'s Grow Chat Server listening on port 8080.');
});

// Set up server socket and socket event listeners
io.on('connection', function(socket) {	
	socket.on('User Entered Message', serverReceivedMessage);
	socket.on('User Sends Private Message', sendPrivateMessage);
	socket.on('User Creates Room', createRoom);
	socket.on('User Connected To Room', userConnected);
	socket.on('disconnect', userDisconnected);
	socket.on('User Requests Room List', getFullRoomList);
	socket.on('User Requests User List', getRoomUserList);
	socket.on('User Requests Room History', getRoomHistory);
	socket.on('User Searches Room History', searchRoomHistory);
});

/**
	Called when the server receives a chat message from the client. This will
	broadcast the message out to the room of the client that sent it and log
	the message in the database.
	@message details about the chat message
*/
var serverReceivedMessage = function(message) {
	this.broadcast.to(message.recipient).emit('Received Message', message);

	database.logMessage(this, message, message.recipient);
};

/**
	Called when the server receives a private message from a client. This 
	emits the message back only to the intended recipient socket.
	@message details about the private message, including the recipient socket ID
*/
var sendPrivateMessage = function(message) {	
	this.broadcast.to(message.recipient).emit('Received Private Message', message);
}

/**
	Called after a client request to create a new room. This adds the room to the
	server's list of chat rooms and broadcasts to all users that there has been a 
	new room added so the UI can update.
	@room new room 
*/
var createRoom = function(room) {
	roomList.push(room.name);

	this.broadcast.emit('Room Added', room.name);
};

/**
	Called when a user connects to a room. This will register the user's socket ID in the 
	list of connected users and connect the new user to the room he or she is trying to join.
	This will also alert the other sockets in the room that there is a new user so the UI 
	chatter list can update.
	@connection new user's connection information
*/
var userConnected = function(connection) {	
	if (connection && connection.user) {
		registerUser(this.id, connection.user);
		
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

/**
	Called when a socket disconnects from the app. This will remove their socket ID from
	the list of connected sockets and send a message to all users that this socket has 
	disconnected.
*/
var userDisconnected = function() {	
	delete connectedUsers[this.id];
	
	io.emit('User Disconnected', this.id);
}

/**
	Returns an updated user list for the requested room to the socket issuing the request.
	@room name of the room to get the user list for
*/
var getRoomUserList = function(room) {		
	this.emit('Room User List', roomUserList(room));
}

/**
	Returns the full room list to the requesting socket.
*/
var getFullRoomList = function() {	
	this.emit('Send Full Room List', roomList);
}

/**
	Returns the list of messages from the database for the requester's current room to
	the requesting socket.
	@room current room name 
*/
var getRoomHistory = function(room) {	
	getHistory(this, [ room ]);
}

/**
	Takes a search term from the UI to search the database for in the room's messages.
	@filterItems contains the room and messageText to search against
*/
var searchRoomHistory = function(filterItems) {		
	getHistory(this, [ filterItems.room, filterItems.text])
}

// Helper functions

/**
	Registers the connecting socket and username in the server's list.
	@socketId Connecting socket ID
	@user Google User name
*/
var registerUser = function(socketId, user) {
	if (!(socketId in connectedUsers)) {		
		user.token = socketId;
		
		connectedUsers[socketId] = user;
	}
}

/**
	Checks the room's socket list and makes a list of usernames also connected
	to the room.
	@room Room to get list of usernames for
*/
var roomUserList = function(room) {
	var roomUserList = [];
	
	if (io.sockets.adapter.rooms[room]) {
		for (var socket in io.sockets.adapter.rooms[room].sockets) {
			roomUserList.push(connectedUsers[socket]);
		}
	}
	
	return roomUserList;
}

/**
	Called by the user requesting the chat history for the current room. Also 
	contains a list of arguments to pass to the python script to search the 
	database.
	@socket requesting socket to send the history results to
	@filterArgs contains [ <roomName> ] or [ <roomName>, <text to search> ]
*/
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
	
	shell.on('message', function (message) {
		results.push(message);
	});  
	
	shell.end(function (err) {
		if (err) {
			throw err;
		}
		
		socket.emit('Send Room History', results);
	});	
}
