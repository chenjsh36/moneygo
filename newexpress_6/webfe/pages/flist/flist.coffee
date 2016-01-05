$.ajax({
	type: 'get'
	dataType: 'json'
	url: '/getList'
	success: (data) ->
		console.log data
	error: (data) ->
		console.log 'Error', data

})