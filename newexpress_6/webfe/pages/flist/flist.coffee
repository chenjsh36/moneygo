EventEmitter = require('../../lib/eventemitter2/eventemitter2').EventEmitter2
eventbus = require('../../own_modules/eventbus/eventbus')

# PageVisibility = require('../../own_modules/PageVisibility')

# statusChange = (e) ->
# 	console.log new Date()
# 	console.log e
# 	console.log @hidden
# 	console.log @visibilitystate

# PageVisibility.visibilitychange(statusChange)

# $.ajax({
# 	type: 'get'
# 	dataType: 'json'
# 	url: '/getList'
# 	success: (data) ->
# 		console.log data
# 	error: (data) ->
# 		console.log 'Error', data

# })

class Flist extends EventEmitter
	constructor: (options)->
		context = @
		@defaults = 
			name: @getVal(options.name, 'cjj')
			container: @getVal(options.container, $('body'))
			elem: null
			eventbus: @getVal(options.eventbus, null)
		@datas = null

		@.on 'Flist:request', @request
		eventbus.on 'Flist:request', @request

		callback_ = (data) ->
			context.calData(data)
			context.render()
		eventbus.emit 'Flist:request', callback_
	

	###*
	 * 处理数据
	 * @param  {obj} data 未处理的函数
	 * @return {bool}      是否含有数据
	###
	calData: (data) ->
		has_data = true
		flist = []
		err = ''
		if data['ret_code']? and parseInt(data['ret_code']) == 200
			if data['data']? and data['data'].length > 0
				$.each data['data'], (i, e) ->
					flist.push {
						id: e.id
						belong_id: e.belong_id
						date: e.date 
						number: e.number
						type_id: e.type_id
						tag_arr: e.tag_arr
					}
			else
				console.log 'data length less then 0'
				has_data = false
		else
			console.log 'ret_code not 200'
			has_data = false
			err = if data['err']? then data['err'] else 'http state not 200!'
		@datas = 
			has_data: has_data
			flist: flist
		console.log @datas
		return has_data

	###*
	 * 返回obj的值，不存在则返回defaults
	 * @param  {obj} obj      对象的属性值
	 * @param  {obj} defaults 默认值
	 * @return {obj}          返回值
	###
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults
	
	initHtml: () ->
		c_html_ = """
			<div class="olive twelve wide column"></div>
		"""
		@defaults.container.html c_html_ 

	###*
	 * 读取对象的datas并渲染对象
	 * @return {obj} 当前对象
	###
	render: () ->
		if @datas.has_data
			table_html = """
				<table class="ui selectable inverted table">
				  	<thead>
					    <tr>
					        <th>date</th>
					        <th>cost</th>
					        <th class="left aligned">type</th>
					    </tr>
				    </thead>
				    <tbody>
				  	</tbody>
				</table>
			"""
			table = $(table_html)
			items_html = ''
			$.each @datas.flist, (i, e) ->
				date_ = e.date.slice(0, 10)
				cost_ = e.number
				type_ = e.tag_arr.join(' ')
				item_html = """
					<tr>
						<td>#{date_}</td>
						<td>#{cost_}</td>
						<td>#{type_}</td>
					</tr>
				"""
				items_html += item_html
			table.find('tbody').html(items_html)
			@defaults.container.append(table)
		else
			console.log '暂无数据，请创建'	

	###*
	 * 请求财务信息列表
	 * @param  {Function} callback 请求完成后调用的函数
	 * @return {null}            none
	###
	request: (callback) ->
		$.ajax {
			type: 'get'
			dataType: 'json'
			url: '/getList'
			success: (data) ->
				console.log data
				callback(data)
			error: (data) ->
				console.log 'Error', data
				callback(data)
				
		}

options = 
	name: 'cjs'
	container: $('.ui.grid.finance .olive.twelve.wide.column')

_flist = new Flist(options)
console.log _flist.defaults.name
