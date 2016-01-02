(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
console.log('reg form validate');

$('#reg-form').form({
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
    },
    confirmpassword: {
      identifier: 'confirm-password',
      rules: [
        {
          type: 'match[password]',
          prompt: 'Your passwords do not match. Please try again.'
        }
      ]
    }
  }
});



},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkU6XFxjaGVuanNoMzZcXG15ZGV2ZWxvcFxcbm9kZVxcbmV3ZXhwcmVzc182XFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJFOlxcY2hlbmpzaDM2XFxteWRldmVsb3BcXG5vZGVcXG5ld2V4cHJlc3NfNlxcd2ViZmVcXHBhZ2VzXFxyZWdcXHJlZy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxPQUFPLENBQUMsR0FBUixDQUFZLG1CQUFaOztBQUVBLENBQUEsQ0FBRSxXQUFGLENBQ0MsQ0FBQyxJQURGLENBQ087RUFDTCxNQUFBLEVBQ0M7SUFBQSxJQUFBLEVBQ0M7TUFBQSxVQUFBLEVBQVksVUFBWjtNQUNBLEtBQUEsRUFBTztRQUNOO1VBQ0MsSUFBQSxFQUFNLE9BRFA7VUFFQyxNQUFBLEVBQVEsd0JBRlQ7U0FETSxFQUtOO1VBQ0MsSUFBQSxFQUFNLDZCQURQO1VBRUMsTUFBQSxFQUFRLG9EQUZUO1NBTE07T0FEUDtLQUREO0lBYUEsUUFBQSxFQUNDO01BQUEsVUFBQSxFQUFZLFVBQVo7TUFDQSxLQUFBLEVBQU87UUFDTjtVQUNDLElBQUEsRUFBTSxPQURQO1VBRUMsTUFBQSxFQUFRLDRCQUZUO1NBRE0sRUFLTjtVQUNDLElBQUEsRUFBTSxrQ0FEUDtVQUVDLE1BQUEsRUFBUSw2REFGVDtTQUxNO09BRFA7S0FkRDtJQTBCQSxlQUFBLEVBQ0M7TUFBQSxVQUFBLEVBQVksa0JBQVo7TUFDQSxLQUFBLEVBQU87UUFDTjtVQUNDLElBQUEsRUFBTSxpQkFEUDtVQUVDLE1BQUEsRUFBUSxnREFGVDtTQURNO09BRFA7S0EzQkQ7R0FGSTtDQURQIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnNvbGUubG9nICdyZWcgZm9ybSB2YWxpZGF0ZSdcclxuXHJcbiQgJyNyZWctZm9ybSdcclxuXHQuZm9ybSB7XHJcblx0XHRmaWVsZHM6XHJcblx0XHRcdG5hbWU6XHJcblx0XHRcdFx0aWRlbnRpZmllcjogJ3VzZXJuYW1lJ1xyXG5cdFx0XHRcdHJ1bGVzOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHR5cGU6ICdlbXB0eSdcclxuXHRcdFx0XHRcdFx0cHJvbXB0OiAnUGxlYXNlIGVudGVyIHlvdXIgbmFtZSdcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ3JlZ0V4cFsvXlthLXpBLVowLTlfLV0rJC9pXSdcclxuXHRcdFx0XHRcdFx0cHJvbXB0OiAnQWNjb3VudCBzaG91bGQgb25seSBjb250YWluZXIgYS16IEEtWiAwLTkgXyBhbmQgLS4nXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRdXHJcblx0XHRcdHBhc3N3b3JkOlxyXG5cdFx0XHRcdGlkZW50aWZpZXI6ICdwYXNzd29yZCdcclxuXHRcdFx0XHRydWxlczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAnZW1wdHknXHJcblx0XHRcdFx0XHRcdHByb21wdDogJ1BsZWFzZSBlbnRlciB5b3VyIHBhc3N3b3JkJ1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAncmVnRXhwWy9eW2EtekEtWjAtOV8tXXs2LDIwfSQvaV0nXHJcblx0XHRcdFx0XHRcdHByb21wdDogJ1Bhc3N3b3JkIHNob3VsZCBjb250aWFucyA2LTIwIGFscGhhIG9mIGEteiBBLVogMC05IF8gYW5kIC0uJ1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRdXHJcblx0XHRcdGNvbmZpcm1wYXNzd29yZDpcclxuXHRcdFx0XHRpZGVudGlmaWVyOiAnY29uZmlybS1wYXNzd29yZCdcclxuXHRcdFx0XHRydWxlczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAnbWF0Y2hbcGFzc3dvcmRdJ1xyXG5cdFx0XHRcdFx0XHRwcm9tcHQ6ICdZb3VyIHBhc3N3b3JkcyBkbyBub3QgbWF0Y2guIFBsZWFzZSB0cnkgYWdhaW4uJ1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdF1cclxuXHR9Il19
