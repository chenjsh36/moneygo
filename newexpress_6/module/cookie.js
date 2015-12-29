
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
		// signed: true // signed 设置后报错
	});
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

/**
 * 获取cookie
 * @param  {[type]} err  [description]
 * @param  {[type]} req  [description]
 * @param  {[type]} name [description]
 * @return {[type]}      [description]
 */
var getCookie = function (req, key) {
	// if (req.signedCookie[name]) {
	// 	return req.signedCookie[name];
	// }
	// else {
	// 	return null;
	// }
	if (typeof req.cookies[key] !== 'undefined') {
		return req.cookies[key];
	}
	return undefined;
}

module.exports = {
	setCookie: setCookie,
	getCookie: getCookie,
	delCookie: delCookie
}