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

winston.level = 'error';
winston.add(winston.transports.File, { filename: 'system.log' });

var Kaede = new Discord.Client({
	forceFetchUsers: true,
	autoReconnect: true
});
var Database;

var unusedQuotes = JSON.parse(JSON.stringify(speech.quotes));

Kaede.on('message', function(message) {
	if (message.author.id === '95602058723336192') {
		adminCommand(message, message.channel);
	}

	if (/^!quote/.test(message.content.toLowerCase())) {
		quote(message.channel);
	} else if (/^!karma/.test(message.content.toLowerCase())) {
		if (/^!karma\s*$/.test(message.content.toLowerCase())) {
			getUserKarma(
				message,message.author.id,
				true
			);
		} else {
			getUserKarma(
				message,message.content.toLowerCase().replace(/\D/g,''),
				false
			);
		}
	} else if (/^!requestaccess/.test(message.content.toLowerCase())) {
		roleGiver(message);
	} else if (/^<@!?\d+>\s*(\+|-)$|^(\+|-)\s*<@!?\d+>$/.test(message.content.toLowerCase())) {
		// TODO - Fix Karma
		// Disabled Karma actions for the time being while they're worked on
		var pos;
		if (message.content.replace(/[^-+]/g,'') === '+') {
			pos = true;
		} else {
			pos = false;
		}
		updateUserKarma(pos,message.content.replace(/\D/g,''),message);
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
			winston.error(error);
			Kaede.sendMessage(
				'177030781254762496',
				'Program error, check my console!'
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
					newMessage = randomQuote(speech.roles.nsfw);
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

function updateUserKarma(isPos,toUser,message) {
	var newMessage;
	var karmaChange;
	var activeChange;
	var fromUser = message.author.id;

	if (toUser === fromUser) {
		newMessage = randomQuote(speech.karma.sameuser);
		Kaede.reply(
			message,
			newMessage
		).catch(err);
		return;
	}

	if (isPos) {
		karmaChange = 1;
		activeChange = 1;
	} else {
		karmaChange = -1;
		activeChange = 0;
	}

	checkFromUserEligible(err,karmaUpdate);

	function checkFromUserEligible(error, callback) {
		Database.collection('karma').findOne({
			userId: Long.fromString(fromUser)
		},{
			lastId: 1,
			lastSent: 1,
			lastTime: 1
		}).then(function(result) {

			var retTime = new Date();
			retTime.setMinutes(retTime.getMinutes() - 10);
			var cooldownTimer = new Date();
			cooldownTimer.setMinutes(cooldownTimer.getMinutes() - 2);

			if (
				Long(result.lastId.low_, result.lastId.high_)
				.equals(Long.fromString(toUser)) &&
				result.lastTime.getTime() >= retTime.getTime()
			) {
				newMessage = randomQuote(speech.karma.retaliation);
				callback(newMessage,false,updateFromUser);
			} else if (
				result.lastSent && result.lastSent.getTime() >= cooldownTimer.getTime()
			) {
				newMessage = randomQuote(speech.karma.cooldown);
				callback(newMessage,false,updateFromUser);
			} else {
				callback(false,true,updateFromUser);
			}
		}).catch(error);
	}

	function updateFromUser(error,validAttempt) {
		if (!validAttempt) {
			newMessage = error;
			Kaede.reply(
				message,
				newMessage
			).catch(err);
		} else {
			if (isPos) {
				newMessage = randomQuote(speech.karma.positive);
			} else {
				newMessage = randomQuote(speech.karma.negative);
			}

			Database.collection('karma').findOneAndUpdate({
				userId: Long.fromString(fromUser)
			},{
				$set: {
					lastSent: new Date()
				}
			}).then(function() {
				Kaede.reply(
					message,
					newMessage
				).catch(err);
			});
		}

	}

	function karmaUpdate(error,isEligible,callback) {
		if (!isEligible) {
			callback(error,false);
		} else {
			Database.collection('karma').findOneAndUpdate({
				userId: Long.fromString(toUser)
			},{
				$inc: {
					totalScore: karmaChange,
					activeScore: activeChange
				},
				$set: {
					lastTime: new Date(),
					lastId: Long.fromString(fromUser)
				}
			}).then(function(result) {
				winston.debug(JSON.stringify(result));
				if (result.lastErrorObject.updatedExisting === false) {
					Database.collection('karma').insertOne({
						userId: Long.fromString(toUser),
						totalScore: 0,
						activeScore: 0,
						lastTime: new Date(),
						lastId: 0,
						lastSent: 0
					}).then(function() {
						karmaUpdate(error,isEligible,callback);
					}).catch(err);
				} else {
					callback(false,true);
				}
			}).catch(error);
		}
	}
}

function randomQuote(quoteArray) {
	return quoteArray[Math.floor(Math.random() * quoteArray.length)].text;
}

function getUserKarma(message,userid,isOwn) {
	var newMessage;

	if (isNaN(userid) || userid === '') {
		Kaede.reply(
			message,
			randomQuote(speech.karma.nouser)
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

	var randomQuote =
		unusedQuotes.splice(Math.floor(Math.random() * unusedQuotes.length),1);

	Kaede.sendMessage(
		channel,
		randomQuote[0].text
	).catch(err);

	if (unusedQuotes.length === 0) {
		unusedQuotes = JSON.parse(JSON.stringify(speech.quotes));
	}
}

function err(error) {
	winston.error(error);
}

Kaede.loginWithToken(config.token).catch(err);
