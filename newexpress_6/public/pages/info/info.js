(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
console.log('info form');

$('#info-form').form({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXHBhZ2VzXFxpbmZvXFxpbmZvLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLE9BQU8sQ0FBQyxHQUFSLENBQVksV0FBWjs7QUFDQSxDQUFBLENBQUUsWUFBRixDQUNDLENBQUMsSUFERixDQUNPO0VBQ0wsTUFBQSxFQUNDO0lBQUEsSUFBQSxFQUNDO01BQUEsVUFBQSxFQUFZLFVBQVo7TUFDQSxLQUFBLEVBQU87UUFDTjtVQUNDLElBQUEsRUFBTSxPQURQO1VBRUMsTUFBQSxFQUFRLHdCQUZUO1NBRE0sRUFLTjtVQUNDLElBQUEsRUFBTSw2QkFEUDtVQUVDLE1BQUEsRUFBUSxvREFGVDtTQUxNO09BRFA7S0FERDtJQWFBLFFBQUEsRUFDQztNQUFBLFVBQUEsRUFBWSxVQUFaO01BQ0EsS0FBQSxFQUFPO1FBQ047VUFDQyxJQUFBLEVBQU0sT0FEUDtVQUVDLE1BQUEsRUFBUSw0QkFGVDtTQURNLEVBS047VUFDQyxJQUFBLEVBQU0sa0NBRFA7VUFFQyxNQUFBLEVBQVEsNkRBRlQ7U0FMTTtPQURQO0tBZEQ7R0FGSTtDQURQIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnNvbGUubG9nICdpbmZvIGZvcm0nXHJcbiQgJyNpbmZvLWZvcm0nXHJcblx0LmZvcm0ge1xyXG5cdFx0ZmllbGRzOlxyXG5cdFx0XHRuYW1lOlxyXG5cdFx0XHRcdGlkZW50aWZpZXI6ICd1c2VybmFtZSdcclxuXHRcdFx0XHRydWxlczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAnZW1wdHknXHJcblx0XHRcdFx0XHRcdHByb21wdDogJ1BsZWFzZSBlbnRlciB5b3VyIG5hbWUnXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHR5cGU6ICdyZWdFeHBbL15bYS16QS1aMC05Xy1dKyQvaV0nXHJcblx0XHRcdFx0XHRcdHByb21wdDogJ0FjY291bnQgc2hvdWxkIG9ubHkgY29udGFpbmVyIGEteiBBLVogMC05IF8gYW5kIC0uJ1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XVxyXG5cdFx0XHRwYXNzd29yZDpcclxuXHRcdFx0XHRpZGVudGlmaWVyOiAncGFzc3dvcmQnXHJcblx0XHRcdFx0cnVsZXM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ2VtcHR5J1xyXG5cdFx0XHRcdFx0XHRwcm9tcHQ6ICdQbGVhc2UgZW50ZXIgeW91ciBwYXNzd29yZCdcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ3JlZ0V4cFsvXlthLXpBLVowLTlfLV17NiwyMH0kL2ldJ1xyXG5cdFx0XHRcdFx0XHRwcm9tcHQ6ICdQYXNzd29yZCBzaG91bGQgY29udGlhbnMgNi0yMCBhbHBoYSBvZiBhLXogQS1aIDAtOSBfIGFuZCAtLidcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRdXHJcblx0fSJdfQ==
