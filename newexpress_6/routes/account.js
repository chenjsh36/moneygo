/*
	Module require
 */
var express = require('express')
	, bodyParser = require('body-parser')
	, multer = require('multer')
	// , db = require('./../module/db.js')
	, user_db = require('./../model/user.js')
	;

/*
	Exports and Create Server
 */
var app = module.exports = express();	

var upload = multer();// for parsing multipart/form-data

/**
 * Use middler
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

	console.log('===================================================================================');
	console.log('请求信息：');
	console.log('请求地址：', req.path);
	// 打印ip地址，获取ip地址列表
	console.log('远程ip地址为：', req.ip);
	// 当trust proxy为true，解析X-Forwarded-For获取ip地址列表，否则值为空数组。
	console.log('远程ips地址为：', req.ip);
	
	// 打印当前时间
	var now = new Date();
	console.log(now.getYear() - 100 + '年' + (now.getMonth() + 1) + '月' + now.getHours() + '时' + now.getMinutes() + '分' + now.getSeconds() + '秒');

	console.log('===================================================================================');
	next();
};

/**
 * 设置cookie
 * @param {http} res    响应
 * @param {string} name   cookie名称
 * @param {string or obj} val    cookie值
 * @param {int} expire 持续时间 
 */
var setCookie = function (res, name, val, expire) {
	var days = expire * 24 * 60 * 60;
	res.cookie(name, val, {
		expires: new Date(Date.now() + days),
		signed: true // signed 设置后报错
	});
}

var authenticate = function (search_user, fn) {
	/*
	Database
	 */
	// db.open(function(){
	// 	db.collection('user').find().toArray(function(err, result){
	// 		if (err) {
	// 			return fn(err);
	// 			// throw err;
	// 		}
	// 		db.collection('user').find(search_user).toArray(function(err, result){
	// 			if (err) {
	// 				// throw err;
	// 				return fn(err);
	// 			}
	// 			if (result.length === 0) {
	// 				return fn(new Error('用户名不存在或者密码错误'));
	// 				// res.send('not ok');
	// 			} else {
	// 				return fn (null, true)
	// 				// setCookie(res, 'username', search_user.username, 30);
	// 				// res.send('ok');
	// 			}
	// 		})
	// 	});
	// });
	user_db.connect();
	// user_db.allToUser(function(err, doc) {
	// 	if (err) {
	// 		console.log('allToUser: err', err);
	// 	} else {
	// 		console.log('allToUser: no err');
	// 		console.log(doc);
	// 	}
	// 	user_db.disconnect();
	// });
	// user_db.add({real_name:'cjs', password: '123456', mail:'chenjsh36@outlook.com', birth: new Date()}, function(err) {
	// 	if (err) {
	// 		console.log(err);
	// 	} else {
	// 		console.log('add ok');
	// 	}
	// })
	user_db.findUser(search_user, function(err, doc) {
		user_db.disconnect();
		if (err) {
			fn(err);
		} else {
			fn(null, doc);
		}

	});
	// user_db.disconnect()
}

var listAll = function (fn) {
	user_db.connect();
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
	user_db.disconnect();
}
/**
 * 删除cookie
 * @param  {http} res  res
 * @param  {string} name cookie name
 * @return {}      
 */
var delCookie = function (res, name) {
	res.clearCookie(name);
}

var getCookie = function (err, req, name) {
	// if (req.signedCookie[name]) {
	// 	return req.signedCookie[name];
	// }
	// else {
	// 	return null;
	// }
}

app.use(logRequestMs);

/**
 * Router
 */
app.get(['/', '/login'], function (req, res, next) {
	// 直接返回字符串
	// res.send('hello, welcome to log in view');
	// 使用模板引擎
	var isLogin = false;
	if (getCookie(req, 'username')) {
		isLogin = true;
	}
	res.render('login', {authenticated: isLogin});
});

// 注册页面
app.get('/reg', function(req, res) {
	res.render('reg', {title: '注册'});
});

// 注册请求
app.post('/reg', function(req, res) {

});

// 登陆页面
// app.get('/login', function(req, res){
// 	res.render('login', { title: '登录'});
// });

// 登陆请求
app.post('/login', upload.array(), function (req, res, next) {
	console.log('account.js: req.body:', req.body);
	var username_ = req.body.username
		, password_ = req.body.password
		;
	// username: cjs, password: 123456
	var search_user = {
		real_name: username_,
		password: password_
	};
	authenticate(search_user, function(err, isAuth) {
		if (err) {
			console.log(err);
			res.redirect('/user');
		} else {
			console.log('pass auth');
			// setCookie(res, 'username', search_user.username, 30);
			res.send('ok');
		}
	})
});

// 登出页面
app.get('/logout', function(req, res) {

});

// 测试页面
app.get('/info', function (req, res, next) {
	res.send('Hello, welcome to personal info view');
});

app.get('/badreq', function (req, res, next) {
	// res.status(403).end();
	res.status(400).send('Bad request');
});