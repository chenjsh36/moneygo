/**
 * 数据库定义
 */

/**
 * 模块依赖
 * @type {module}
 */
var express = require('express')
	, mongoose = require('mongoose')
	;

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

var connect = module.exports = mongoose.connect(url);