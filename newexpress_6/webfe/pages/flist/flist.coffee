EventEmitter = require('../../lib/eventemitter2/eventemitter2').EventEmitter2
eventbus = require('../../own_modules/eventbus/eventbus')
# PageVisibility = require('../../own_modules/PageVisibility')

class Flist extends EventEmitter
	constructor: (options)->
		# super.apply @, arguments
		context = @
		@defaults = 
			name: @getVal(options.name, 'cjj')
			container: @getVal(options.container, $('body'))
			elem: null
			f_list_table: new FListTable({
				container: @getVal(options.container, $('body'))
				flist: context
			}) 
			eventbus: @getVal(options.eventbus, null)
		@datas = null

		@.on 'Flist:request', @request
		@defaults.eventbus.on 'Flist:request', @request

		@.on 'FList:dataChange', @dataChange

		callback_ = (data) ->
			context.calData(data)
			context.render()
		eventbus.emit 'Flist:request', callback_
	
	###*
	 * 更新数据
	###
	dataChange: (data) ->
		context = @
		console.log 'Flist: dataChange:', data
		# setTimeout(()->
		# 	console.log 'to emit '
		# 	context.defaults.f_list_table.emit 'FListTable:dataChange', {}
		# , 5000)
		send_data = 
			edit: data 
		console.log('before send :', send_data);
		$.ajax {
			type: 'POST'
			url: '/edit'
			data: send_data
			success: (data) ->
				console.log data 
				context.defaults.f_list_table.emit 'FListTable:dataChange', {}
			error: (data)->
				console.log data 
				context.defaults.f_list_table.emit 'FListTable:dataChange', {}
		}

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
		return has_data

	###*
	 * 返回obj的值，不存在则返回defaults
	 * @param  {obj} obj      对象的属性值
	 * @param  {obj} defaults 默认值
	 * @return {obj}          返回值
	###
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults
	
	# initHtml: () ->
	# 	c_html_ = """
	# 		<div class="olive twelve wide column"></div>
	# 	"""
	# 	@defaults.container.html c_html_ 

	###*
	 * 读取对象的datas并渲染对象
	 * @return {obj} 当前对象
	###
	render: () ->
		if @datas.has_data
			# eventbus.emit 'FListTable:renderData', @datas
			@defaults.f_list_table.emit 'FListTable:renderData', @datas
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
				callback(data)
			error: (data) ->
				console.log 'Error', data
				callback(data)
				
		}

# 财务表格插件
# 能够增删差改
class FListTable extends EventEmitter
	constructor: (options) ->
		context = @
		@defaults = 
			name: 'FListTable'
			container: @getVal(options.container, $('body'))
			eventbus: @getVal(options.eventbus, eventbus)
			table: null
			datas: null
			flist: @getVal(options.flist, {})
		@.on 'FListTable:renderData', context.render
		@defaults.eventbus.on 'FListTable:renderData', context.render
		@.on 'FListTable:dataChange', context.dataChange
		@init()
	# 数据修改完成后

	dataChange: (res) ->
		console.log 'FListTable:datachange res: ', res
		$('#edit-flist').text('Edit')
		$('#edit-flist').attr('value', 'Save')
	# 初始化html和时间监听
	init: () ->
		table_html = """
			<div class="ui inverted segment">
				<button class="ui inverted yellow button" id="edit-flist" value="Save">Edit</button>
				<button class="ui inverted red button" id="add-flist">New</button>
			
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
			</div>
		"""		
		table = $(table_html)
		@defaults.container.append(table)
		@defaults.table = table
		context = @
		# 修改按钮
		table.find('#edit-flist').on 'click', (e) ->
			console.log 'edit-flist click!'
			if $(this).attr('value') == 'Save'
				# change to edit view
				# create datetimepicker
				$(this).text('Save')
				$(this).attr('value', 'Edit')
				# 时间选择器监听事件
				$('.time-item').datetimepicker({
					lang: 'ch'
					format: 'YYYY-mm-dd'
					timepicker: false
					onChangeDateTime: (params, input, event) ->
						# 各种时间格式
						console.log arguments, params.getUTCDate(), params.toDateString(), params.toLocaleDateString(), params.toLocaleString(), params.toUTCString()
						# 目前用的是 toLocaleDateString
						# $(this).text(params.toLocaleDateString())
						new_date = params.toLocaleDateString()
						new_date = new_date.split('/').join('-')
						input.text(new_date)

					onShow: (params) ->
						console.log arguments
					})
				costInput = (e) ->
					if $(this).find('input').length == 0
						old = $(this).text()
						$(this).attr('val', old)
						input_html = """<input class="ui inverted input" type="text" value="#{old}"/>"""
						$(this).html(input_html)
				$('.cost-item').on 'click', costInput
				typeInput = (e) ->
					if $(this).find('input').length == 0
						old = $(this).text()
						$(this).attr('val', old)
						input_html = """<input class="ui inverted input" type="text" value="#{old}"/>"""
						$(this).html(input_html)
				$('.type-item').on 'click', typeInput
			else
				# 保存修改后的数据
				$('.time-item').datetimepicker('destroy')
				$.each $('.cost-item'), (i, e) ->
					$input = $(this).find('input')
					if $input.length != 0
						# new_val = $(this).attr('val')
						new_val = $input.val()
						console.log $(this), $(this).attr('val'), new_val
						reg = /^[a-zA-Z0-9\u4e00-\u9fa5 ]+$/

						if reg.test(new_val) == true
							console.log 'true while test the reg:', new_val
							$(this).html(new_val)
						else
							console.log new_val, ' is false while test the reg'
							$(this).html($(this).attr('val'))
				# change to save view
				# request to upate data
				console.log 'defaults:', context.defaults
				# 更新已修改的数据，然后触发flist的datachange:
				$f_list = context.defaults.container.find('tbody tr')
				f_list_data = []
				$.each $f_list, (i, e) ->
					time = $f_list.eq(i).find('.time-item').text()
					cost = $f_list.eq(i).find('.cost-item').text()
					type = $f_list.eq(i).find('.type-item').text()
					id = $f_list.eq(i).attr('alt')
					f_list_data.push {
						id: id
						date : time
						number : cost 
						tag_arr : type
					}
				context.defaults.datas = f_list_data
				context.defaults.flist.emit 'FList:dataChange', context.defaults.datas
				$('.cost-item').unbind('click')
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults

	render: (datas) ->
		context = @
		@defaults.datas = datas
		console.log datas
		items_html = ''
		$.each datas.flist, (i, e) ->
			date_ = e.date.slice(0, 10)
			cost_ = e.number
			type_ = e.tag_arr.join(' ')
			id_ = e.id
			item_html = """
				<tr alt="#{id_}">
					<td class="time-item">#{date_}</td>
					<td class="cost-item">#{cost_}</td>
					<td class="type-item">#{type_}</td>
				</tr>
			"""
			items_html += item_html
		@defaults.table.find('tbody').html(items_html)


options = 
	name: 'cjs'
	container: $('.ui.grid.finance .olive.twelve.wide.column')
	eventbus: eventbus

_flist = new Flist(options)


# f_list_table: new FListTable(options)
