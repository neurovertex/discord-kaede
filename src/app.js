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
var Long		= require('mongodb').Long;
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

	if (/^!quote/.test(message.content.toLowerCase())) {
		quote(message.channel);
	} else if (/^!karma/.test(message.content.toLowerCase())) {
		if (/^!karma\s*$/.test(message.content.toLowerCase())) {
			getUserKarma(message,message.author.id,true);
		} else {
			getUserKarma(message,message.content.toLowerCase().replace(/\D/g,''),false);
		}
	} else if (/^!requestaccess/.test(message.content.toLowerCase())) {
		roleGiver(message);
	// } else if (/@\d+\s?(\+|-)/.test(message.content.toLowerCase())) {
	// 	// Set to only + for now
	// 	updateUserKarma(true,message.content,message.author.id);
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

function roleGiver(message) {
	var newMessage;

	if (/^!requestaccess\s*$/.test(message.content)) {
		Kaede.reply(
			message,
			speech.help.requestAccess
		).catch(err);
	} else {
		var request = message.content.split(/!requestaccess\s*/)[1];
		switch (request.toLowerCase()) {
			case 'nsfw': {
				if (!Kaede.memberHasRole(message.author, '177343546221789185')) {
					Kaede.addMemberToRole(message.author, '177343546221789185').catch(err);
					newMessage = speech.roles.nsfw[Math.floor(Math.random() *
						speech.roles.nsfw.length)].text;
				} else {
					newMessage = 'you already have access to all the NSFW material. ' +
						'How thirsty do you have to be to ask for more?';
				}
				break;
			}
			case 'eve': {
				if (!Kaede.memberHasRole(message.author, '173741530224394240')) {
					Kaede.addMemberToRole(message.author, '173741530224394240').catch(err);
					newMessage = 'docking request...accepted. Did I get the voice right?';
				} else {
					newMessage = 'you are already registered as a capsuleer. ' +
						'Go gank someone.';
				}
				break;
			}
			case 'developer': {
				if (!Kaede.memberHasRole(message.author, '177030915954966528')) {
					Kaede.addMemberToRole(message.author, '177030915954966528').catch(err);
					newMessage = 'hasDevRole = true';
				} else {
					newMessage = 'var already set...or something. ' +
						'You\'re already a developer.';
				}
				break;
			}
			default: {
				newMessage = 'no such option! Try *!requestaccess*';
			}
		}

		Kaede.reply(
			message,
			newMessage
		).catch(err);
	}
}

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

function getRoleDetails(message) {
	var roles = Kaede.servers.get('id',config.serverid).roles;

	var newMessage = 'There are the following server roles:\n\n';

	roles.forEach(function(value) {
		newMessage += '*' + value.name + '* - ' + value.id + '\n';
	});

	Kaede.sendMessage(
		message.channel,
		newMessage
	).catch(err);
}

function updateUserKarma(isPos,toUser,fromUser) {
	var newMessage;
	var karmaChange;
	var activeChange;

	if (isPos) {
		karmaChange = 1;
		activeChange = 1;
	} else {
		karmaChange = -1;
		activeChange = 0;
	}

	Database.collection('karma').findOneAndUpdate({
		userId: Long.fromString(toUser)
	},{
		$inc: {
			totalScore: karmaChange,
			activeScore: activeChange
		},
		lastTime: new Date(),
		lastId: Long.fromString(fromUser)
	})
	.toArray(function(error,result) {
		winston.debug(error);
		winston.debug(result);
	});
}

function getUserKarma(message,userid,isOwn) {
	var newMessage;

	if (isNaN(userid)) {
		Kaede.reply(
			message,
			speech.help.karma.nouser[Math.floor(Math.random() *
				speech.help.karma.nouser.length)].text
		).catch(err);
		return;
	}

	Database.collection('karma').find({userId: Long.fromString(userid)})
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
		} else if (result.length === 0) {
			Database.collection('karma').insertOne({
				userId: Long.fromString(userid),
				totalScore: 0,
				activeScore: 0,
				lastTime: new Date(),
				lastId: 0,
				lastSent: 0
			}).then(function() {
				getUserKarma(message,userid,isOwn);
			}).catch(err);
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
	} else if (message.content.match(/^!getuserinfo(.*)/)) {
		var targetId = message.content
			.substring(message.content.indexOf(':') + 1).trim().replace(/\D/g,'');
		// Fetch ID Command Issued

		newMessage = getUserDetails(targetId);

		Kaede.sendMessage(
			channel,
			newMessage
		).catch(err);
	} else if (message.content.match(/^!getroles(.*)/)) {
		getRoleDetails(message);
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
