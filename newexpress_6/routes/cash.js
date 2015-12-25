/**
 * 模块依赖
 * @type {module}
 */
// var express = require('express')
// 	, mongoose = require('mongoose')
// 	;

// mongoose.connect('mongodb://127.0.0.1:27017/newexpress')


// /*
// 	Exports and Create Server
//  */
// var app = module.exports = express();

// var db = mongoose.connection
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', function() {
// 	// we 're connected!
// 	console.log ('we connect!');
// });

// app.use('/', function(req, res) {
// 	res.send('connect?');
// })

// //举例：
// // 创建的schema，为后面的model提供公共的属性
// var ExampleSchema = new Schema({
// 	name:String,
// 	binary:Buffer,
// 	living:Boolean,
// 	updated:Date,
// 	age:Number,
// 	mixed:Schema.Types.Mixed, //该混合类型等同于nested
// 	_id:Schema.Types.ObjectId,  //主键
// 	_fk:Schema.Types.ObjectId,  //外键
// 	array:[],
// 	arrOfString:[String],
// 	arrOfNumber:[Number],
// 	arrOfDate:[Date],
// 	arrOfBuffer:[Buffer],
// 	arrOfBoolean:[Boolean],
// 	arrOfMixed:[Schema.Types.Mixed],
// 	arrOfObjectId:[Schema.Types.ObjectId]
// 	nested:{
// 	stuff:String,
// 	}
// });

// // 提高公公共的方法
// // 查询类似数据
// ExampleSchema.methods.findSimilarTypes = function(cb) {
// 	return this.model('xxx').find({type:this.type}, cb);
// }

// var ExampleModel = mogoose.model('Example', ExampleSchema);
// var krouky = new ExampleSchema({name: 'krouky', type: '前端工程师'});
// krouky.findSimilarTypes(function(err, persons) {

// });

// ExampleSchema.statics.findByName = function(name, cb) {
// 	this.find({name: new RegExp(name: 'i'), cb});
// }

// var PersonModel = mongoose.model('Person', PersonSchema);

// PersonModel.findByName('krouky', function(err, persons) {

// });

// // 虚拟属性，不写入数据库
// PersonSchema.virtual('name.full').get(function() {
// 	return this.name.first + ' ' + this.name.last;
// });