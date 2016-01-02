(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
console.log('log in form');

$('#login-form').form({
  fields: {
    name: {
      identifier: 'username',
      rules: [
        {
          type: 'empty',
          prompt: 'Please enter your name'
        }, {
          type: 'regExp[/^[a-zA-Z0-9_-]+$/i]',
          prompt: 'Account should only container a-z A-Z 0-9 _ and -.'
        }
      ]
    },
    password: {
      identifier: 'password',
      rules: [
        {
          type: 'empty',
          prompt: 'Please enter your password'
        }, {
          type: 'regExp[/^[a-zA-Z0-9_-]{6,20}$/i]',
          prompt: 'Password should contians 6-20 alpha of a-z A-Z 0-9 _ and -.'
        }
      ]
    }
  }
});



},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXHBhZ2VzXFxsb2dpblxcbG9naW4uY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDdUJBLE9BQU8sQ0FBQyxHQUFSLENBQVksYUFBWjs7QUFDQSxDQUFBLENBQUUsYUFBRixDQUNDLENBQUMsSUFERixDQUNPO0VBQ0wsTUFBQSxFQUNDO0lBQUEsSUFBQSxFQUNDO01BQUEsVUFBQSxFQUFZLFVBQVo7TUFDQSxLQUFBLEVBQU87UUFDTjtVQUNDLElBQUEsRUFBTSxPQURQO1VBRUMsTUFBQSxFQUFRLHdCQUZUO1NBRE0sRUFLTjtVQUNDLElBQUEsRUFBTSw2QkFEUDtVQUVDLE1BQUEsRUFBUSxvREFGVDtTQUxNO09BRFA7S0FERDtJQWFBLFFBQUEsRUFDQztNQUFBLFVBQUEsRUFBWSxVQUFaO01BQ0EsS0FBQSxFQUFPO1FBQ047VUFDQyxJQUFBLEVBQU0sT0FEUDtVQUVDLE1BQUEsRUFBUSw0QkFGVDtTQURNLEVBS047VUFDQyxJQUFBLEVBQU0sa0NBRFA7VUFFQyxNQUFBLEVBQVEsNkRBRlQ7U0FMTTtPQURQO0tBZEQ7R0FGSTtDQURQIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiMgY2xhc3MgVG9wYmFyXHJcbiMgXHRuYW1lOiAnY2pzJ1xyXG4jIFx0YWdlOiAxMFxyXG4jIFx0QGNsYXNzID0gMVxyXG5cclxuIyBcdEB3aGVyZTogKCktPlxyXG4jIFx0XHRjb25zb2xlLmxvZyAnd2hlcmUgaSBhbT8nXHJcblxyXG4jIFx0c2F5OiAoKS0+XHJcbiMgXHRcdGNvbnNvbGUubG9nICdoZWxsbycsIEBhZ2UrKywgQGNsYXNzXHJcblxyXG5cclxuIyBiYXIgPSBuZXcgVG9wYmFyXHJcbiMgYmFyLnNheSgpXHJcbiMgYmFyLnNheSgpXHJcbiMgIyBiYXIud2hlcmUoKVxyXG4jIFRvcGJhci53aGVyZSgpXHJcblxyXG4jIGJhcjIgPSBuZXcgVG9wYmFyXHJcbiMgYmFyMi5zYXkoKVxyXG4jIGJhcjIuc2F5KClcclxuXHJcblxyXG5jb25zb2xlLmxvZyAnbG9nIGluIGZvcm0nXHJcbiQgJyNsb2dpbi1mb3JtJ1xyXG5cdC5mb3JtIHtcclxuXHRcdGZpZWxkczpcclxuXHRcdFx0bmFtZTpcclxuXHRcdFx0XHRpZGVudGlmaWVyOiAndXNlcm5hbWUnXHJcblx0XHRcdFx0cnVsZXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ2VtcHR5J1xyXG5cdFx0XHRcdFx0XHRwcm9tcHQ6ICdQbGVhc2UgZW50ZXIgeW91ciBuYW1lJ1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAncmVnRXhwWy9eW2EtekEtWjAtOV8tXSskL2ldJ1xyXG5cdFx0XHRcdFx0XHRwcm9tcHQ6ICdBY2NvdW50IHNob3VsZCBvbmx5IGNvbnRhaW5lciBhLXogQS1aIDAtOSBfIGFuZCAtLidcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdF1cclxuXHRcdFx0cGFzc3dvcmQ6XHJcblx0XHRcdFx0aWRlbnRpZmllcjogJ3Bhc3N3b3JkJ1xyXG5cdFx0XHRcdHJ1bGVzOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHR5cGU6ICdlbXB0eSdcclxuXHRcdFx0XHRcdFx0cHJvbXB0OiAnUGxlYXNlIGVudGVyIHlvdXIgcGFzc3dvcmQnXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHR5cGU6ICdyZWdFeHBbL15bYS16QS1aMC05Xy1dezYsMjB9JC9pXSdcclxuXHRcdFx0XHRcdFx0cHJvbXB0OiAnUGFzc3dvcmQgc2hvdWxkIGNvbnRpYW5zIDYtMjAgYWxwaGEgb2YgYS16IEEtWiAwLTkgXyBhbmQgLS4nXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XVxyXG5cdH0iXX0=
