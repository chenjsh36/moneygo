/**
 * 模块依赖
 * @type {module}
 */
var express = require('express')
	, mongoose = require('mongoose')
	;

var Schema = mongoose.Schema;
// 数据库地址
url = 'mongodb://127.0.0.1:27017/newexpress'
// mongoose.connect('mongodb://127.0.0.1:27017/newexpress')


/*
	Exports and Create Server
 */

// var db = mongoose.connection
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', function() {
// 	// we 're connected!
// 	console.log ('we connect!');
// });


exports.connect = function(callback) {
	console.log('user_db connect');
	mongoose.connect(url);

}
exports.disconnect = function(callback) {
	console.log('user_db disconnect!');
	mongoose.disconnect(callback);
}

exports.setup = function(callback) {
	callback(null);
}

// 定义对象模型
var UserScheme = new Schema({
	real_name: String,
	password: String,
	mail: String,
	birth: Date

});

// 访问user对象

mongoose.model('User', UserScheme);
var User = mongoose.model('User');

exports.add = function(user, callback) {
	var new_user = new User();
	new_user.real_name = user.real_name;
	new_user.password = user.password;
	new_user.mail = user.mail;
	new_user.birth = user.birth;

	new_user.save(function(err) {
		if (err) {
			callback(err);
		} else {
			callback(null);
		}
	});
}

exports.delete = function(id, callback) {
	exports.findUserById(id, function(err, doc) {
		if (err) {
			callback(err);
		} else {
			doc.remove();
			callback(null);
		}
	});
}

exports.editMs = function(id, key, val, callback) {
	exports.findUserById(id, function(err, doc) {
		if (err) {
			callback(err);
		} else {
			doc.key = val;
			doc.save(function(err) {
				if (err) {
					callback(err);
				} else {
					callback(null);
				}
			})
		}
	});
}


exports.allToUser = function(callback) {
	User.find({}, callback);
}

exports.forAll = function(doEach, done) {
	User.find({}, function(err, docs) {
		if (err) {
			done(err,null);
		}
		docs.forEach(function(doc) {
			doEach(null, doc);
		});
		done(null);
	});
}

exports.findUser = function(user, done) {
	console.log('findUser:', user);
	User.find(user, function(err, doc) {
		if (err) {
			console.log('findUser: is err');
			done(err, null);
		} else {
			console.log('findUser: no err');
			done(null, doc);
		}
	})
}

var findUserById = exports.findUserById = function(id, callback) {
	Todo.findOne({_id: id}, function(err, doc) {
		if (err) {
			callback(err, null);
		} 
		callback(null, doc);
	});
}

