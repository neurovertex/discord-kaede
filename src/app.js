var Discord	= require('discord.js');
var winston = require('winston');
var config	= require('./res/config.json');
var speech	= require('./res/speech.json');


winston.level = 'debug';
winston.add(winston.transports.File, { filename: 'system.log' });

var Kaede = new Discord.Client();

Kaede.on('message', function(message) {
	if (message.channel.recipient && message.author.id === '95602058723336192') {
		adminCommand(message);
	}

	switch (message.content) {
		case ('!quote'): {
			quote(message.channel);
			break;
		}
	}
});

function adminCommand(message) {
	if (message.content.match(/^s:(.*)/)) {
		var newMessage = message.content
			.substring(message.content.indexOf(':') + 1).trim();
		// Speak Command Issued
		Kaede.sendMessage(
			'165611042464858112',
			newMessage
		).catch(err);
	}
}

function quote(channel) {
	var randomQuote =
		speech.quotes[Math.floor(Math.random() * speech.quotes.length)];
	Kaede.sendMessage(
		channel,
		randomQuote.text
	).catch(err);
}

function err(error) {
	winston.error(error);
}

Kaede.loginWithToken(config.token).catch(err);
