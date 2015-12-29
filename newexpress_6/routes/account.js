/*
	Module require
 */
var express = require('express')
	, bodyParser = require('body-parser')
	, multer = require('multer')
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
 * Middleware
 */

/**
 * 打印请求信息
 * @param  {http}   req  请求
 * @param  {http}   res  响应
 * @param  {func} next 继续下一个请求
 * @return {}        
 */
var logRequestMs = function (req, res, next) {

	console.log('============================== 请求信息 =====================================================');
	console.log('请求地址：', req.path);
	// 打印ip地址，获取ip地址列表
	console.log('远程ip地址为：', req.ip);
	// 当trust proxy为true，解析X-Forwarded-For获取ip地址列表，否则值为空数组。
	console.log('远程ips地址为：', req.ip);
	console.log('请求的cookie:', req.cookies);
	// 打印当前时间
	var now = new Date();
	console.log('请求时间：', now.getYear() - 100 + '年' + (now.getMonth() + 1) + '月' + now.getHours() + '时' + now.getMinutes() + '分' + now.getSeconds() + '秒');

	console.log('================================结束请求信息===================================================');
	next();
};

var listAll = function (fn) {
	user_db.allToUser(function(err, doc) {
		if (err) {
			console.log('err');
		} else {
			console.log('ok');
			doc.forEach(function(doc) {
				console.log('_id:', doc._id)
				console.log('real_name ', doc.real_name);
				console.log('password ', doc.password);
				console.log('birth ', doc.birth);
				console.log('mail ', doc.mail);
			})
		}
	});
}


/**
 * 使用应用级中间件
 */
app.use(logRequestMs);

/**
 * Router 使用路由级中间件
 */

// 注册页面
app.get('/reg', function(req, res) {
	res.render('reg', {title: '注册'});
});

// 注册请求
app.post('/reg', function(req, res) {
	var username_ = req.body.username
		, password_ = req.body.password
		;
	var register_user = {
		real_name: username_,
		password: password_,
		mail: '',
		birth: new Date()
	};
	user_db.findUser({real_name: username_}, function(err, doc) {
		if (err) {
			console.log('not found, and err is ', err.errors);
		} else {
			console.log('no err, and find user is ', doc, doc.length);
			if (doc.length === 0) {
				// 该用户名还未被注册
				user_db.add(register_user, function(err) {
					if (err) {
						res.render('reg', {success: false, err: err.errors});
					} else {
						res.redirect('/user/login');
					}
				});
			} else {
				console.log('用户名已经存在！');
				res.render('reg', {success: false, err: '用户名已经存在'});
			}
		}
	})

});

// 登陆页面
app.get(['/', '/login'], function (req, res, next) {
	var isLogin = false,
		username = ''
		;
	username = getCookie(req, 'username');
	if (typeof username !== 'undefined') {
		isLogin = true;
		username = req.cookies.username;
	}
	res.render('login', {authenticated: isLogin, username: username});
});

// 登陆请求
app.post('/login', upload.array(), function (req, res, next) {
	var username_ = req.body.username
		, password_ = req.body.password
		;
	// username: cjs, password: 123456
	var search_user = {
		real_name: username_,
		password: password_
	};
	user_db.findUser(search_user, function(err, doc) {
		if (err) {
			console.log(err);
			delCookie(res, 'username');
			res.redirect('/user', {success: false, err: err.errors});
		} else {
			console.log('pass auth');
			setCookie(res, 'username', search_user.real_name, 30);
			res.redirect('/user/info');
		}
	});
});

// 登出页面
app.get('/logout', function(req, res) {
	delCookie(res, 'username');
	res.redirect('/user/login');
});

// 测试页面
app.get('/info', function (req, res, next) {
	var isLogin = false,
		username = undefined
		;
	username = getCookie(req, 'username');
	if (typeof username !== 'undefined') {
		isLogin = true;
	}
	res.render('info', {authenticated: isLogin, username: username})
});

app.get('/badreq', function (req, res, next) {
	res.status(400).send('Bad request');
});