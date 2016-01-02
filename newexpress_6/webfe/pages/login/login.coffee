# class Topbar
# 	name: 'cjs'
# 	age: 10
# 	@class = 1

# 	@where: ()->
# 		console.log 'where i am?'

# 	say: ()->
# 		console.log 'hello', @age++, @class


# bar = new Topbar
# bar.say()
# bar.say()
# # bar.where()
# Topbar.where()

# bar2 = new Topbar
# bar2.say()
# bar2.say()


console.log 'log in form'
$ '#login-form'
	.form {
		fields:
			name:
				identifier: 'username'
				rules: [
					{
						type: 'empty'
						prompt: 'Please enter your name'
					}
					{
						type: 'regExp[/^[a-zA-Z0-9_-]+$/i]'
						prompt: 'Account should only container a-z A-Z 0-9 _ and -.'
					}
					
				]
			password:
				identifier: 'password'
				rules: [
					{
						type: 'empty'
						prompt: 'Please enter your password'
					}
					{
						type: 'regExp[/^[a-zA-Z0-9_-]{6,20}$/i]'
						prompt: 'Password should contians 6-20 alpha of a-z A-Z 0-9 _ and -.'
					}
				]
	}