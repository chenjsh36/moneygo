/*
	Module dependence
 */
var express = require('express')
	, account_r = require('./routes/account')
	, cash_r = require('./routes/cash')
	, mongo_db = require('./module/db')
	, path = require('path')
	, connect = require('connect')
	, cookieParser = require('cookie-parser')
	, session = require('express-session')
	, MongoStore = require('connect-mongo')(session)
	, settings = require('./module/setting')
	, methodOverride = require('method-override')// 错误处理中间件定义一般在最后
	;

/*
	Create server
 */
var app = express();

/*
	Set options
 */
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
console.log('app_views:', app.set('views'));

app.enable('trust proxy');

/**
 * Use cookie
 */
// 使用失败
// console.log(settings.cookieSecret, settings.db);
app.use(cookieParser('secret'));
// app.use(session({
// 	secret: settings.cookieSecret,
// 	// key: settings.db,
// 	// cookie: {maxAge: 1000 * 60 * 60 * 24 * 30}, // For 30 days
// 	store: new MongoStore({
// 		db: settings.db
// 	}, function(){
// 		console.log('connect mongodb success...');
// 	})
// }));

/*
	Route
 */
// 用户登陆、注册、退出
app.use('/user', account_r);
// 个人财务支出情况
// app.use('/cash', cash_r);
// 为静态文件添加路径
app.use('/static', express.static('public'));
/*
	Listen at port and host 
 */
var port = 3080;
var server = app.listen(port, function(){
	var host = server.address().address;
	var port = server.address().port;

	console.log('App listening at http://%s:%s', host, port);
});

