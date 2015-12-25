var mongodb = require('mongodb');
/*
	Database
 */
// var mongoClient = mongodb.MongoClient;
// var db_obj;
// mongoClient.connect('mongodb://localhost:27017/newexpress', function(err, db){
// 	if (err) {
// 		throw err;
// 	}
// 	db.collection('user').find().toArray(function(err, result){
// 		if (err) {
// 			throw err;
// 		}
// 		console.log(result);
// 	});
// });

var db_url = 'localhost', 
	db_port = '27017',
	db_name = 'newexpress',
	db_cookie_secret = 'money'
	;
var mongodb_server = new mongodb.Server('localhost', 27017, {auto_reconnect: true, poolSize: 10});
var db = new mongodb.Db(db_name, mongodb_server);
db.collection('user').find().toArray(function(err, result){
	console.log('to search');
	if (err) {
		throw err;
	}
	console.log(result);
});
module.exports = db; 