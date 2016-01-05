(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
$.ajax({
  type: 'get',
  dataType: 'json',
  url: '/getList',
  success: function(data) {
    return console.log(data);
  },
  error: function(data) {
    return console.log('Error', data);
  }
});



},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXHBhZ2VzXFxmbGlzdFxcZmxpc3QuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsQ0FBQyxDQUFDLElBQUYsQ0FBTztFQUNOLElBQUEsRUFBTSxLQURBO0VBRU4sUUFBQSxFQUFVLE1BRko7RUFHTixHQUFBLEVBQUssVUFIQztFQUlOLE9BQUEsRUFBUyxTQUFDLElBQUQ7V0FDUixPQUFPLENBQUMsR0FBUixDQUFZLElBQVo7RUFEUSxDQUpIO0VBTU4sS0FBQSxFQUFPLFNBQUMsSUFBRDtXQUNOLE9BQU8sQ0FBQyxHQUFSLENBQVksT0FBWixFQUFxQixJQUFyQjtFQURNLENBTkQ7Q0FBUCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIkLmFqYXgoe1xyXG5cdHR5cGU6ICdnZXQnXHJcblx0ZGF0YVR5cGU6ICdqc29uJ1xyXG5cdHVybDogJy9nZXRMaXN0J1xyXG5cdHN1Y2Nlc3M6IChkYXRhKSAtPlxyXG5cdFx0Y29uc29sZS5sb2cgZGF0YVxyXG5cdGVycm9yOiAoZGF0YSkgLT5cclxuXHRcdGNvbnNvbGUubG9nICdFcnJvcicsIGRhdGFcclxuXHJcbn0pIl19
