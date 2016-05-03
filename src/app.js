//  _  __              _
// | |/ /__ _  ___  __| | ___
// | ' // _` |/ _ \/ _` |/ _ \
// | . \ (_| |  __/ (_| |  __/
// |_|\_\__,_|\___|\__,_|\___|
//
// Chatbot for the Discord Shift Guild
//
// Please note, Kaede cannot connect to multiple servers on a single instance
//
// All reference info is contained within the config.json file, and must be
// filled out before attempting to run the application
// String data for Kaede herself is within the speech.json file

var Discord	= require('discord.js');
var winston = require('winston');
var mongo		= require('mongodb').MongoClient;
var config	= require('./res/config.json');
var speech	= require('./res/speech.json');

winston.level = 'debug';
winston.add(winston.transports.File, { filename: 'system.log' });

var Kaede = new Discord.Client({forceFetchUsers: true});
var Database;

var unusedQuotes = speech.quotes;

Kaede.on('message', function(message) {
	if (message.author.id === '95602058723336192') {
		adminCommand(message, message.channel);
	}

	if (/!quote/.test(message.content)) {
		quote(message.channel);
	} else if (/!karma/.test(message.content)) {
		if (/^!karma\s*$/.test(message.content)) {
			getUserKarma(message,message.author.id,true);
		} else {
			getUserKarma(message,message.content.replace(/\D/g,''),false);
		}
	}
});

Kaede.on('ready', function() {
	connectDb(function(error) {
		if (!error) {
			Kaede.sendMessage(
				'177030781254762496',
				'Program Loaded'
			).catch(err);
		} else {
			winston.error(err);
			Kaede.sendMessage(
				'177030781254762496',
				'Program Error, check my console!'
			).catch(err);
		}
	});
});

function connectDb(callback) {
	mongo.connect(config.mongodb, function(err, db) {
		if (!err) {
			Database = db;
			return callback(null);
		}
		return callback(err);
	});
}

function getUserDetails(userid) {
	var user = Kaede.users.get('id',userid);
	var game = 'not in-game';

	if (user.game) {
		game = user.game.name;
	}

	var details = 'Display Name: ' + user.username + '\n' +
		'Discriminator: ' + user.discriminator + '\n' +
		'True Username: ' + user.id + '\n' +
		'Status: ' + user.status + '\n' +
		'Game: ' + game + '\n' +
		'Bot: ' + user.bot + '\n';

	return details;
}

function getUserKarma(message,userid,isOwn) {
	var newMessage;

	Database.collection('karma').find({userId: parseInt(userid)})
	.toArray(function(error,result) {
		if (!error && result.length > 0) {
			if (isOwn) {
				newMessage = 'you\'ve got ' + result[0].totalScore +
					' karma and ' + result[0].activeScore + ' active points.';
			} else {
				newMessage = 'that user has ' + result[0].totalScore +
					' karma and ' + result[0].activeScore + ' active points.';
			}

			Kaede.reply(
				message,
				newMessage
			).catch(err);
		} else {
			err(error);
		}
	});
}

function adminCommand(message, channel) {
	var newMessage;

	if (message.content.match(/^s:(.*)/)) {
		newMessage = message.content
			.substring(message.content.indexOf(':') + 1).trim();
		// Speak Command Issued
		Kaede.sendMessage(
			'165611042464858112',
			newMessage
		).catch(err);
	} else if (message.content.match(/^getuserinfo:(.*)/)) {
		var targetId = message.content
			.substring(message.content.indexOf(':') + 1).trim().replace(/\D/g,'');
		// Fetch ID Command Issued

		newMessage = getUserDetails(targetId);

		Kaede.sendMessage(
			channel,
			newMessage
		).catch(err);
	}
}

function quote(channel) {

	if (unusedQuotes.length === 0) {
		unusedQuotes = speech.quotes;
	}

	var randomQuote =
		unusedQuotes.splice(Math.floor(Math.random() * unusedQuotes.length),1);

	Kaede.sendMessage(
		channel,
		randomQuote[0].text
	).catch(err);
}

function err(error) {
	winston.error(error);
}

Kaede.loginWithToken(config.token).catch(err);
