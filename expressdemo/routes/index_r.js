/*
	Module require
 */

var express = require('express')
	, http = require('http')
	, bodyParser = require('body-parser')
	, multer = require('multer')
	, wsio = require('socket.io')
	;

/*
	Exports and Create Server
 */
var app = module.exports = express();	

var upload = multer();// for parsing multipart/form-data
// 需要
var server = http.createServer(app);
var ws = wsio.listen(server);
server.listen(80);

/**
 * Use middler 第三方中间件
 */
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded


app.get('/', function(req, res) {
	console.log('visit index!');
	res.render('index', {title: '注册'});
});

// 这里进行
var onlineUsers = {};
var onlineCount = 0;
ws.sockets.on('connection', function(socket) {
	// 聊天室
	console.log('a user connected');
	// 新成员加入
	socket.on('login', function(obj) {
		socket.name = obj.userid;
		if (!onlineUsers.hasOwnProperty(obj.userid)) {
			onlineUsers[obj.userid] = obj.username;
			onlineCount++;
		}
		ws.sockets.emit('login', {onlineUsers:onlineUsers, onlineCount:onlineCount, user: obj});
		console.log(obj.username + '加入了聊天室！');
	});
	// 成员离开
	socket.on('disconnect', function(obj) {
		if ( onlineUsers.hasOwnProperty(socket.name)) {
			// 退出用户信息
			var obj = {userid: socket.name, username: onlineUsers[socket.name]};
			// 删除
			delete onlineUsers[socket.name];
			// 在线人数-1
			onlineCount--;
			// 广播用户退出
			ws.sockets.emit('disconnect', {onlineUsers:onlineUsers, onlineCount: onlineCount, user: obj});
			console.log(obj.username + '退出了聊天室');
		}
	});

	// 成员发言
	socket.on('message', function(msg) {
		// 广播发布的信息
		ws.sockets.emit('message', msg);
		console.log(msg.username + '说：', + msg.content);
	});

	// socket.to('others').emit('anevent', {some: 'data'});
	// socket.emit('news', { data: 'hello world!' });//监听，一旦客户端连接上，即发送数据，第一个参数'new'为数据名，第二个参数既为数据  
	// socket.on('my new event', function (data) {//捕获客户端发送名为'my other event'的数据  
	// 	console.log(data);  
	// });

	// // socket.emit('other', { data: 'other event' });//发送另一个数据  
	// socket.on('event1', function (data) {//捕获另外一个数据  
	// 	console.log(data);  
	// });
	// socket.on('message', function(msg) {
	// 	console.log('Got: ', msg);
	// 	socket.send('pong');
	// });
});