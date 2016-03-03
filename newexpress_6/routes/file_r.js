/*
	Module require
 */
var express = require('express')
	, bodyParser = require('body-parser')
	, multer = require('multer')
	, finance_db = require('./../model/finance.js')
	, user_db = require('./../model/user.js')
	, cookie = require('./../module/cookie.js')
	;


/*
	Exports and Create Server
 */
var app = module.exports = express();	

var upload = multer();// for parsing multipart/form-data


/**
 * 路由级
 */
app.get('/', function(req, res) {
	// 读取excel依赖的模块
	var xlsx = require('node-xlsx');

	// 读出来后是数组
	var list = xlsx.parse('./excel/finance.xls');

	var i = 0, len = 0, j = 0, len2 = 0;
	for (i = 0, len = list.length; i < len; i++) {
		// list[i]是一个个的工作表,数组，包含每一个个的obj
		data_ = list[i].data;
		len2 = data_.length;
		for(j = 0; j < len2; j++) {
			console.log(data_[j], data_[j].join(' ')); 
		}
	}
	res.render('test', {title: 'test'});
});
