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

getCookie = cookie.getCookie;
delCookie = cookie.delCookie;
setCookie = cookie.setCookie;


/*
	Exports and Create Server
 */
var app = module.exports = express();	

var upload = multer();// for parsing multipart/form-data


/**
 * Use middler 第三方中间件
 */
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

/**
 * 应用级插件
 */
var checkLogin = function(req, res, next) {
	username = getCookie(req, 'username');
	if (typeof username == 'undefined') {
		res.redirect('/user/login');
	}
	else {
		next();
	}
}
app.use(checkLogin);

/**
 * 路由级
 */

// 注册页面
app.get('/list', function(req, res) {
	flist = [{number:12}];

	finance_db.forAll(function(err, doc){
		if (err) {
			console.log('do each error: ', err.errors)
		} else {
			flist.push(doc);
		}
	}, function(err, doc) {
		if (err) {
			console.log('error exist', err.errors);
			res.render('flist', {title: '消费记录', success: false, flist: []});
		} else {
			res.render('flist', {title: '消费记录', flist: flist});
		}
	});
});

app.post('/add', function(req, res) {
	var number = req.body.number
		, date = req.body.date
		, type_id = req.body.type_id
		, tag_arr = req.body.tag_arr.split(' ') 
		;
	var username_ = getCookie(req, 'username');

	user_db.findUser({real_name: username_}, function(err, doc) {
		if (err) {
			console.log('not found user , and err is ', err.errors);
		} else {
			console.log('no err, and find user is ', doc, doc.length);
			if (doc.length === 0) {
				// 该用户名不存在，返回错误
				res.send('用户不存在！');
			} else {
				console.log('用户名存在', doc);
				var user_id = doc[0]['_id'];
				console.log('userId is :', user_id);

				var new_finance = {
					belong_id: user_id.toString(),
					number: number,
					date: new Date(),
					type_id: type_id,
					tag_arr: ['教育', '生活']
				};

				finance_db.add(new_finance, function(err) {
					if (err) {
						res.render('flist', {success: false, err: err.errors});
					} else {
						res.redirect('list');
						// res.send('add ok');
					}
				});
			}
		}
	})
});

app.post('/del', function(req, res) {
});

app.post('/search', function(req, res) {
});

app.post('/edit', function(req, res) {
});



