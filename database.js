var moment = require('moment');	
	
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');

var messageSchema = new mongoose.Schema({
	username:	{ type: String },
	messageText:	{type: String},
	room:		{type: String},
	timestamp:	{type: String}
});

(function() {
	var logMessage = function(socket, message, room) {
		
		var messageModel = mongoose.model('chat_messages', messageSchema);
		
		var momentNow = moment();
		
		var newmsg = new messageModel({ 
			"username": message.user.name, 
			"messageText": message.text, 
			"room": room, 
			"timestamp": momentNow.format('YYYY-MM-DD h:mm:ss')
		});
		
		newmsg.save(function (err) {		
			if (err) {
				console.log(err);
			}
		});	
	};
	
	module.exports.logMessage = function(socket, message, room) {
		logMessage(socket, message, room);
	}

}());

