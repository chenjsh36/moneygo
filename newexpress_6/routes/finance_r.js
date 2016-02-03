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
// app.use(checkLogin);

/**
 * 路由级
 */
app.get('/test', function(req, res) {
	res.render('test', {title: 'test'})
});

app.get(['/', '/list'], function(req, res) {
	var isLogin = true
		, username = getCookie(req, 'username')
		, flist = []
		;

	finance_db.forAll(function(err, doc){
		if (err) {
			console.log('do each error: ', err.errors)
		} else {
			flist.push(doc);
		}
	}, function(err, doc) {
		if (err) {
			console.log('error exist', err.errors);
			res.render('flist', {title: '消费记录', success: false, flist: [], authenticated: isLogin, username: username});
		} else {
			res.render('flist', {title: '消费记录', flist: flist, authenticated: isLogin, username: username});
		}
	});
});
// 获取该用户的所有数据
app.get('/getList', function(req, res) {
	// var username = getCookie(req, 'username')
	// 	, user_id = ''
	// 	, user_flist
	// 	;
	// user = user_db.findUser({real_name: username}, function(err, doc) {
	// 	if (err) {
	// 		console.log('使用cookie查找该用户名找不到！');
	// 		res.redirect('/user/login');
	// 	} else {
	// 		user_id = doc['_id'];
	// 		finance_db.find({belong_id: user_id}, function(err, docs) {
	// 			if (err) {
	// 				console.log('查到该用户的财务数据失败！');
	// 				res.redirect('/');
	// 			} else {
	// 				res.json(docs);
	// 			}
	// 		})
	// 	}
	// })
	finance_db.allToFinance(function(err, doc) {
		if (err) {
			console.log('finde all err', err);
			res.json({retCode: '400', err: err, data: []});
		} else {
			var f_len = doc.length,
				i = 0,
				ret_doc = [];
			for(; i < f_len; i++) {
				ret_doc.push({
					belong_id: doc[i].belong_id,
					date: doc[i].date,
					id: doc[i].id.toString(),
					number: doc[i].number,
					tag_arr: doc[i].tag_arr,
					type_id: doc[i].type_id
				})
			}
			res.json({ret_code: '200', data: ret_doc});
		}
	})
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
	var edit = req.body.edit;
	console.log('edit:', edit);
	for (var i = 0, len = edit.length; i < len; i++) {
		finance_db.editMs(edit[i].id, edit[i], function(err) {
			console.log(err);
		})
	}
	// finance_db.editMs()
});




