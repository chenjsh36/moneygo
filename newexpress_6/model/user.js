/**
 * 数据库定义
 */

/**
 * 模块依赖
 * @type {module}
 */
var express = require('express')
	, mongoose = require('mongoose')
	, connect = require('./db')
	;

var Schema = mongoose.Schema;
// 数据库地址
// url = 'mongodb://127.0.0.1:27017/newexpress'
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

// var connect = mongoose.connect(url);

// 定义对象模型
var UserScheme = new Schema({
	real_name: {type: String, default: '匿名'},
	password: {type: String, default: '123'},
	mail: {type: String, default: ''},
	birth: {type: Date, default: Date.now}

});

// 访问user对象
// (注意)NOTE: methods must be added to the schema before compiling it with mongoose.model()
UserScheme.methods.speak = function() {
	var greeting = this.real_name ? 'My name is ' + this.real_name : 'I don\'t have a name...';
	console.log(greeting);
}

mongoose.model('User', UserScheme);
var User = mongoose.model('User');


exports.connect = function(callback) {
	console.log('user_db connect');
	// mongoose.connect(url);
	return connect;
}
exports.disconnect = function(callback) {
	console.log('user_db disconnect!');
	mongoose.disconnect(callback);
}

exports.setup = function(callback) {
	callback(null);
}

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

exports.editMs = function(name, newms, callback) {
	exports.findUserByRealname(name, function(err, doc) {
		if (err) {
			callback(err);
		} else {
			for (key in newms) {
				if (key !== '_id') {
					console.log('editMs :', key);
					doc[key] = newms[key];
				} else {
					console.log('id could not change');
				}
			}
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
	User.findOne(user, function(err, doc) {
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
	User.findOne({_id: id}, function(err, doc) {
		if (err) {
			callback(err, null);
		} else {
			callback(null, doc);	
		} 
	});
}

var findUserByRealname = exports.findUserByRealname = function(name, callback) {
	User.findOne({real_name: name}, function(err, doc) {
		if (err) {
			callback(err, null);
		}
		else {
			callback(null, doc);
		}
	})
}
