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
var FinanceSchema = new Schema({
	belong_id: {type: String},  
	number: {type: Number, default: '0.00'},
	date: {type: Date, default: Date.now},
	type_id: {type: Number, default: '0'},// learning\playing\living
	tag_arr: [String]
});

// 访问user对象
// (注意)NOTE: methods must be added to the schema before compiling it with mongoose.model()
FinanceSchema.methods.speak = function() {
	var greeting = this.number ? 'This FinanceSchema is ' + this.number : 'I don\'t have a number...';
	console.log(greeting);
}

mongoose.model('Finance', FinanceSchema);
var Finance = mongoose.model('Finance');


exports.connect = function(callback) {
	console.log('finance connect');
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

exports.add = function(finance, callback) {
	var new_finance = new Finance();
	new_finance.belong_id = finance.belong_id;
	new_finance.number = finance.number;
	new_finance.date = finance.date;
	new_finance.type_id = finance.type_id;
	new_finance.tag_arr = finance.tag_arr;

	new_finance.save(function(err) {
		if (err) {
			callback(err);
		} else {
			callback(null);
		}
	});
}

exports.delete = function(id, callback) {
	exports.findFinanceById(id, function(err, doc) {
		if (err) {
			callback(err);
		} else {
			doc.remove();
			callback(null);
		}
	});
}

exports.editMs = function(id, key, val, callback) {
	exports.findFinanceById(id, function(err, doc) {
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


exports.allToFinance = function(callback) {
	Finance.find({}, callback);
}

exports.forAll = function(doEach, done) {
	Finance.find({}, function(err, docs) {
		if (err) {
			done(err,null);
		}
		docs.forEach(function(doc) {
			doEach(null, doc);
		});
		done(null);
	});
}

exports.findFinance = function(finance, done) {
	console.log('findUser:', user);
	Finance.find(finance, function(err, doc) {
		if (err) {
			console.log('findFinance: is err');
			done(err, null);
		} else {
			console.log('findFinance: no err');
			done(null, doc);
		}
	})
}

var findFinanceById = exports.findFinanceById = function(id, callback) {
	Finance.findOne({_id: id}, function(err, doc) {
		if (err) {
			callback(err, null);
		} 
		callback(null, doc);
	});
}

