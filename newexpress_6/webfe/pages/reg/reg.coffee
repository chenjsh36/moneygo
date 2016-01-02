console.log 'reg form validate'

$ '#reg-form'
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
			confirmpassword:
				identifier: 'confirm-password'
				rules: [
					{
						type: 'match[password]'
						prompt: 'Your passwords do not match. Please try again.'
					}
				]
	}