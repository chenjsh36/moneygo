/*
	Module dependence
 */
var express = require('express')
	, path = require('path') // 第三方中间件
	, connect = require('connect') // 第三方中间件
	, cookieParser = require('cookie-parser') // cookie解析中间件
	, session = require('express-session') // session解析中间件
	, MongoStore = require('connect-mongo')(session) // 第三方中间件
	, index_r = require('./routes/index_r')
	// , settings = require('./module/setting') // 基本设置
	// , account_r = require('./routes/account') // 用户登录、注册、退出路由
	// , cash_r = require('./routes/cash') // 测试路由
	// , finance_r = require('./routes/finance_r') // 财务路由
	// , mongo_db = require('./module/db') // 纯mongodb使用
	, methodOverride = require('method-override')// 错误处理中间件定义一般在最后
	, wsio = require('socket.io')
	;


/*
	Create server
 */
var app = express();

/*
	Set options
 */
app.set('view engine', 'jade'); // 模板引擎
app.set('views', __dirname + '/views'); // 模板引用路径
// console.log('app_views:', app.set('views'));

app.enable('trust proxy'); // 查看源IP地址使用

/**
 * Use cookie
 */
app.use(cookieParser());

/*
	Route
 */

app.use('/', index_r);

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

