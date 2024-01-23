
module.exports = function(waw) {
	const bcrypt = require('bcrypt-nodejs');
	const schema = waw.mongoose.Schema({
		is: {},
		data: {},
		host: String,
		thumb: {type: String, default: '/assets/default.png'},
		email: String,
		reg_email: String,
		password: String,
		name: String,
		resetPin: Number
	}, {
		minimize: false
	});

	schema.methods.generateHash = function(password) {
		return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
	};

	schema.methods.validPassword = function(password) {
		return bcrypt.compareSync(password, this.password);
	};

	schema.methods.create = function(obj, user, sd) {
		this.thumb = obj.thumb || '/assets/default.png';
		this.reg_email = obj.email;
		this.email = obj.email;
		this.host = obj.host;
		this.name = obj.name;
		this.data = {};
		this.is = {}
	}

	return waw.User = waw.mongoose.model('User', schema);
}
