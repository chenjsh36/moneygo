EventEmitter = require('../../lib/eventemitter2/eventemitter2').EventEmitter2
eventbus = require('../../own_modules/eventbus/eventbus')
# PageVisibility = require('../../own_modules/PageVisibility')

# 数据中心
data_center = {}

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
		data_center.flist = flist
		return has_data

	###*
	 * 返回obj的值，不存在则返回defaults
	###
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults
	
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
	show: () ->
		@defaults.container.show()

	hide: () ->
		@defaults.container.hide()

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
				<div class="new-finance-form">
					<label for="time">时间</label>
					<div class="ui input">
						<input type="text" id="new-finance-time" date-time-format="YYYY-mm-dd">
					</div>
					<label for="cost">总额</label>
					<div class="ui input">
						<input type="text" id="new-finance-cost" class="ui inverted input">
					</div>
					<label for="time">类型</label>
					<div class="ui input">
						<input type="text" id="new-finance-type" class="ui inverted input">
					</div>
					<button id="save-new-finance" class="ui button">保存</button>
				</div>
				<table class="ui selectable inverted table">
					<thead>
						<tr>
							<th>date</th>
							<th>cost</th>
							<th class="left aligned">type</th>
							<th class="operate-item-head display-none">operate</th>
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
		
		# 初始化新建消费记录的时间选择器
		table.find('#new-finance-time').datetimepicker({
			lang: 'ch'
			format: 'Y-m-d'
			timepicker: false
			onChangeDateTime: (params, input, event) ->
				# event.preventDefault()
				# event.stopPropagation()
				# console.log 'change date!!'
				# console.log arguments, params.getUTCDate(), params.toDateString(), params.toLocaleDateString(), params.toLocaleString(), params.toUTCString()
				# new_date = params.toLocaleDateString()
				# new_date = new_date.split('/').join('-')
				# console.log 'new date is ', new_date, ' and input is ', input
				# input.val(new_date)
			onShow: (params) ->
				# console.log arguments
		})
		table.find('#save-new-finance').on 'click', (e) ->
			$form = $(this).closest('.new-finance-form')
			time = $form.find('#new-finance-time').val()
			cost = $form.find('#new-finance-cost').val()
			type = $form.find('#new-finance-type').val()
			console.log 'show data:', time, cost, type
			if time == '' or cost == '' or type == ''
				alert('请填写完整的消费记录！')
			if isNaN(cost)
				alert('请填写合法的金额')
			else
				send_data = 
					date: time
					number: cost
					tag_arr: type
					type_id: 0
				$.ajax({
					type: 'POST'
					url: '/add'
					data: send_data
					success: (data) ->
						console.log 'success:', data 
						if data.ret_code == '200'
							alert '添加成功'
						else 
							alert '更新失败'
						location.reload()
					error: (data) ->
						alert '添加失败'
						location.reload()
						# console.log 'error:', data
					})
		# 修改按钮点击事件监听
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
				# 显示删除的选项
				$('.operate-item-head').removeClass('display-none')
				$('.operate-item').removeClass('display-none')
			# 保存修改后的数据
			else
				# 取消时间选择器
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
				$.each $('.type-item'), (i, e) ->
					$input = $(this).find('input')
					if $input.length != 0
						new_val = $input.val()
						if new_val != ''
							$(this).html(new_val)
						else
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
				# 取消绑定
				$('.cost-item').unbind('click')
				$('.type-item').unbind('click')
				# 隐藏删除选项
				$('.operate-item-head').addClass('display-none')
				$('.operate-item').addClass('display-none')
		# 添加按钮点击事件监听
		table.find('#add-flist').on 'click', (e) ->
			console.log 'to add new finance'
			context.defaults.container.find('.new-finance-form').show()
		# 删除按钮点击事件监听
		table.find('tbody').on 'click', '.operate-item', (e) ->
			that = $(this).closest('tr')
			finance_id = that.attr('alt')
			send_data = 
				finance_id: finance_id
			$.ajax({
				type: 'POST'
				url: '/del'
				data: send_data
				success: (data) ->
					if data.ret_code == '200'
						console.log 'delete ok!'
						that.remove()
					else
						console.log 'delete fail'
				error: (data) ->
					console.log 'delete fail'
			})

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
					<td class="operate-item display-none">delete</td>
				</tr>
			"""
			items_html += item_html
		@defaults.table.find('tbody').html(items_html)

# 对收入支出做统计，可视化
class CostChartShow extends EventEmitter
	constructor: (options) ->
		@defaults = 
			container: @getVal(options.container, $('body'))
			
		@init()
	init: () ->
		chart_html = """
			<div id="cost-chart-container" class="chart_container" style="width: 600px; height: 400px;"></div>
		"""
		@defaults.container.hide()
		@defaults.container.html(chart_html)
		if data_center.flist != null
			@defaults.data = data_center.flist
			@showCostChart()
	showCostChart: () ->
		if data_center.flist == null or typeof data_center.flist == 'undefined'
			return
		else 
			flist_ = data_center.flist
			console.log 'flist_:', flist_
			date = []
			data = []
			cal_data = {}
			for f in flist_
				# date.push f.date.slice(0, 10)
				# data.push f.number
				date_ = f.date.slice(0, 10)
				if cal_data[date_]?
					cal_data[date_] += f.number
				else
					cal_data[date_] = f.number
			for c of cal_data
				date.push c
				data.push cal_data[c]
			cost_chart = echarts.init($('#cost-chart-container')[0])
			# base = (new Date(2015, 9, 4)).valueOf()
			# oneDay = 24 * 3600 * 1000
			# date = []
			# data = [Math.random() * 150]

			# for i in [0..100]
			# 	now  = new Date(base += oneDay)
			# 	date.push([now.getFullYear(), now.getMonth() + 1, now.getDate()].join('-'))
			# 	data.push((Math.random() - .4) * 20) + data[i - 1];
			option = {
				title: {
					x: 'center',
					text: '收入支出',
				},
				# legend: {
				# 	top: 'bottom',
				# 	data:['意向']
				# },
				toolbox: {
					show: false,
					feature: {
						mark: {show: true},
						dataView: {show: true, readOnly: false},
						magicType: {show: true, type: ['line', 'bar', 'stack', 'tiled']},
						restore: {show: true},
						saveAsImage: {show: true}
					}
				},
				xAxis: [
					{
						type: 'category',
						boundaryGap: false,
						data: date
					}
				],
				yAxis: [
					{
						type: 'value',
						# max: 500
					}
				],
				dataZoom: {
					type: 'inside',
					start: 60,
					end: 80
				},
				series: [
					{
						name:'成交',
						type:'line',
						smooth:true,
						symbol: 'none',
						stack: 'a',
						areaStyle: {
							normal: {}
						},
						data: data
					}
				]
			}

			cost_chart.setOption(option)
	
	###*
	 * 返回obj的值，不存在则返回defaults
	###
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults
	
	show: () ->
		@showCostChart()
		@defaults.container.show()

	hide: () ->
		@defaults.container.hide()

# 对消费范围做统计，可视化
class RangeChartShow extends EventEmitter
	constructor: (options) ->
		@defaults = 
			container: @getVal(options.container, $('body'))
		@init()
	init: () ->
		chart_html = """
			<div id="range-chart-container" class="chart_container" style="width: 600px; height: 400px;"></div>
		"""
		@defaults.container.hide()
		@defaults.container.html(chart_html)
		if data_center.flist != null
			@defaults.data = data_center.flist
			@showRangeChart()

	update: () ->
		if data_center.flist != null
			@defaults.data = data_center.flist
			@showRangeChart()

	showRangeChart: () ->
		if data_center.flist == null or typeof data_center.flist == 'undefined'
			return
		else 
			tag_map = {}
			for f in data_center.flist
				tag_arr = f.tag_arr
				for t in tag_arr
					if tag_map[t]?
						tag_map[t]++
					else
						tag_map[t] = 1
			console.log 'tag_map:', tag_map
			data = []
			for t of tag_map
				data.push {
					name: t,
					value: tag_map[t]
				}

			cost_chart = echarts.init($('#range-chart-container')[0])
			option = {
			    backgroundColor: '#2c343c',
			    title: {
			        text: 'Customized Pie',
			        left: 'center',
			        top: 20,
			        textStyle: {
			            color: '#ccc'
			        }
			    },

			    tooltip : {
			        trigger: 'item',
			        formatter: "{a} <br/>{b} : {c} ({d}%)"
			    },

			    visualMap: {
			        show: false,
			        min: 80,
			        max: 600,
			        inRange: {
			            colorLightness: [0.2, 1]
			        }
			    },
			    series : [
			        {
			            name:'消费领域',
			            type:'pie',
			            radius : '55%',
			            center: ['50%', '50%'],
			            data:data.sort( (a, b)->  return a.value - b.value),
			            roseType: 'angle',
			            label: {
			                normal: {
			                    textStyle: {
			                        color: 'rgba(255, 255, 255, 0.3)'
			                    }
			                }
			            },
			            labelLine: {
			                normal: {
			                    lineStyle: {
			                        color: 'rgba(255, 255, 255, 0.3)'
			                    },
			                    smooth: 0.2,
			                    length: 10,
			                    length2: 20
			                }
			            },
			            itemStyle: {
			                normal: {
			                    color: '#c23531',
			                    shadowBlur: 200,
			                    shadowColor: 'rgba(0, 0, 0, 0.5)'
			                }
			            }
			        }
			    ]
			};
			cost_chart.setOption(option)

	###*
	 * 返回obj的值，不存在则返回defaults
	###
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults
	show: () ->
		@update()
		@defaults.container.show()

	hide: () ->
		@defaults.container.hide()


# 对个人的消费做词云的可视化
class WordCloud extends EventEmitter
	constructor: (options) ->
		@defaults = 
			container: @getVal(options.container, $('body'))
		@init()
	init: () ->
		d3_html = """
			<div id="word-cloud-container" class="chart_container" style="width: 1200px; height: 800px;"></div>
		"""
		@defaults.container.hide()
		@defaults.container.html(d3_html)
		if data_center.flist != null
			@defaults.data = data_center.flist
			@showWordCloud()

	update: () ->
		if data_center.flist != null
			@defaults.data = data_center.flist
			@showWordCloud()

	showWordCloud: () ->
		if data_center.flist == null or typeof data_center.flist == 'undefined'
			console.log('not ok')
			return
		else 
			draw = (words) ->
				console.log('to draw')
				d3.select("#word-cloud-container").append("svg")
						.attr("width", 1200)
						.attr("height", 800)
					.append("g")
						.attr("transform", "translate(500,500)")
					.selectAll("text")
						.data(words)
					.enter().append("text")
						.style("font-size", (d) -> return d.size + "px" )
						.attr("text-anchor", "middle")
						.attr("transform", (d) ->
							return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")"
						)
						.text((d) -> return d.text )
			console.log('ok')
			rx = [.1, .1, .1, .2, .9, .7, .7, .9, .9]
			ry = [.1, .1, .2, .1, .9, .7, .7, .7, .7]
			font_size = [69, 50, 109, 104, 93, 78, 76, 73, 70]
			d3.layout.cloud().size([1000, 1000])
					.words([
						"Hello", "world", "normally", "you", "want", "more", "words",
						"than", "this"].map((d, i) ->
						return {text: d, size: font_size[i], origin_x: rx[i], origin_y: ry[i]}
					))
					.rotate(() -> return ~~(Math.random() * 2) * 360 )
					.fontSize((d) -> return d.size )
					.on("end", draw)
					.start()

			
	getVal: (obj, defaults) ->
		return if obj? then obj else defaults

	show: () ->
		@defaults.container.show()
		@update()
		

	hide: () ->
		@defaults.container.hide()




options = 
	name: 'cjs'
	container: $('.ui.grid.finance .olive.twelve.wide.column .finance-table')
	eventbus: eventbus

_flist = new Flist(options)


cost_options = 
	container: $('.ui.grid.finance .olive.twelve.wide.column .cost-chart')
_cost = new CostChartShow(cost_options)

range_options = 
	container: $('.ui.grid.finance .olive.twelve.wide.column .range-chart')
_range = new RangeChartShow(range_options)

word_options = 
	container: $('.ui.grid.finance .olive.twelve.wide.column .word-cloud')
_word_cloud = new WordCloud(word_options)



# 边栏事件监听
# 显示消费列表
$('#finance-list').on 'click', (e) ->
	console.log 'to show finance-list'	
	_flist.show()
	_cost.hide()
	_range.hide()
	_word_cloud.hide()

$('#finance-cost').on 'click', (e) ->
	console.log 'to show cost area'
	_flist.hide()
	_cost.show()
	_range.hide()
	_word_cloud.hide()

$('#finance-type').on 'click', (e) ->
	console.log 'to show type'
	_flist.hide()
	_cost.hide()
	_range.show()
	_word_cloud.hide()
$('#d3-cloud').on 'click', (e) ->
	console.log 'to show word-cloud'
	_flist.hide()
	_cost.hide()
	_range.hide()
	_word_cloud.show()
