###*
 * 判断页面是否对用户可见对象
 * @return {object} [hidden: bool, visibilitystate: string, visibilitychange: (fn, bool)]
 * read： http://www.zhangxinxu.com/wordpress/2012/11/page-visibility-api-introduction-extend/
###
PageVisibility = ( ()->
	prefixSupport = ''
	###*
	 * 根据前缀和属性返回带有前缀的属性
	 * @param  {string} prefix 前缀
	 * @param  {string} key    属性
	 * @return {string}        正确的属性如webkitHidden\hidden\msHidden
	###
	keyWithPreFix = (prefix, key) ->
		if prefix != ''
			return prefix + key.slice(0, 1).toUpperCase() + key.slice(1);
		return key

	# 返回document.hidden属性是否支持且是否需要带前缀
	isPageVisibilitySupport = ( ()->
			support = false
			if typeof window.screenX == 'number'
				['webkit', 'moz', 'ms', 'o', ''].forEach( (prefix) ->
					if support  == false and document[keyWithPreFix(prefix, 'hidden')] != undefined
						prefixSupport = prefix
						support = true
					)
			return support
		)()

	# 返回页面是否对用户可见或undefined
	isHidden = () ->
		if isPageVisibilitySupport
			return document[keyWithPreFix(prefixSupport, 'hidden')]
		return undefined

	# 返回页面的状态：visible、hidden、prerender
	visibilitystate = () ->
		if isPageVisibilitySupport
			return document[keyWithPreFix(prefixSupport, 'visibilityState')]
		return undefined

	return {
		hidden: isHidden()
		visibilitystate: visibilitystate()
		visibilitychange: (fn, usecapture) ->
			usecapture = undefined || false
			if (isPageVisibilitySupport and typeof fn == 'function')
				return document.addEventListener(prefixSupport + 'visibilitychange', ((e) ->
					@hidden = isHidden()
					@visibilitystate = visibilitystate()
					fn.call(this, e)
					).bind(@), usecapture
				)
	}
)(undefined)

module.exports = PageVisibility