const { v4: uuidv4 } = require('uuid');
const path = require('path');
const nJwt = require('njwt');
module.exports = function(waw) {
	/* remove support of waw.file */
	waw.file('user', {
		rename: req => req.user._id+'.jpg',
		ensure: waw.ensure,
		process: async (req, res) => {
			const user = await waw.User.findOne({
				_id: req.user._id
			});

			user.thumb = req.files[0].url;

			await user.save();

			res.json(user.thumb);
		}
	});

	/*
	*	User configuration
	*/
	if (!waw.config.signingKey) {
		waw.config.signingKey = uuidv4();

		let serverJson = waw.readJson(process.cwd() + '/server.json');

		serverJson.signingKey = waw.config.signingKey;

		waw.writeJson(process.cwd() + '/server.json', serverJson);
	}

	if (waw.config.mail) {
		const nodemailer = require("nodemailer");

		let transporter = nodemailer.createTransport({
			host: waw.config.mail.host,
			port: waw.config.mail.port,
			secure: waw.config.mail.secure,
			auth: waw.config.mail.auth
		});

		waw.send = (opts, cb = resp => { }) => {
			transporter.sendMail({
				from: waw.config.mail.from,
				subject: opts.subject || waw.config.mail.subject,
				to: opts.to,
				text: opts.text,
				html: opts.html
			}, cb);
		}
	} else {
		waw.send = () => { }
	}

	const set_is = async (email, is) => {
		await waw.wait(300);

		const users = await waw.User.find({
			email: email
		});

		for (const user of users) {
			if (!user) continue;

			if (!user.is) user.is = {};

			user.is[is] = true;

			user.markModified('is');

			await user.save();
		}
	}

	if (waw.config.user && waw.config.user.is) {
		for (const is in waw.config.user.is) {
			const emails = waw.config.user.is[is].split(' ');

			for (var i = 0; i < emails.length; i++) {
				set_is(emails[i], is);
			}
		}
	}

	/* API */
	waw.use((req, res, next) => {
		if (req.headers.token) {
			nJwt.verify(
				req.headers.token,
				waw.config.signingKey,
				(err, verifiedJwt) => {
					if (err) {
						res.set('remove', 'token');
						res.set('Access-Control-Expose-Headers', 'field')
						next();
					} else {
						req.user = verifiedJwt.body;
						next();
					}
				}
			);
		} else next();
	});

	const clearUser = user => {
		user = JSON.parse(JSON.stringify(user));

		delete user.password;

		delete user.resetPin;

		user.token = nJwt.create(user, waw.config.signingKey);

		user.token.setExpiration(new Date().getTime() + (48 * 60 * 60 * 1000));

		user.token = user.token.compact();

		return user;
	};

	const findUser = async (email, host) => {
		return await waw.User.findOne({
			host,
			$or: [{
				reg_email: email.toLowerCase()
			}, {
				email: email.toLowerCase()
			}]
		});
	};

	const new_pin = async (user, cb = ()=>{}) => {
		user.resetPin = Math.floor(Math.random() * (999999 - 100000)) + 100000;

		console.log(user.resetPin);

		user.markModified('data');

		await user.save();

		waw.send({
			to: user.email,
			subject: 'Code: ' + user.resetPin,
			html: 'Code: ' + user.resetPin
		}, cb);
	};

	waw.api({
		router: '/api/user',
		app: path.join(
			process.cwd(), 'client', 'dist', 'app'
		),
		post: {
			"/status": async (req, res) => {
				const user = await findUser(req.body.email, req.get('host'));

				const json = {};

				json.email = !!user;

				if (user && req.body.password) {
					json.pass = user.validPassword(req.body.password);
				}

				res.json(json);
			},
			"/request": async (req, res) => {
				const user = await findUser(req.body.email, req.get('host'));

				if (user) {
					new_pin(user);
				}

				res.json(true);
			},
			"/change": async (req, res) => {
				const user = await findUser(req.body.email, req.get('host'));

				if (user && user.resetPin === req.body.pin) {
					user.password = user.generateHash(req.body.password);

					delete user.resetPin;

					await user.save();

					res.json(true);
				} else if (user) {
					new_pin(user, () => {
						res.json(false);
					});
				}
			},
			"/changePassword": async (req, res) => {
				if (!req.user) return res.send(false);

				const user = await waw.User.findOne({ _id: req.user._id });

				if (user.validPassword(req.body.oldPass)) {
					user.password = user.generateHash(req.body.newPass);

					await user.save();

					res.json(true);
				} else {
					res.json(false);
				}
			},
			'/login': async (req, res) => {
				const user = await findUser(req.body.email, req.get('host'));

				if (!user || !user.validPassword(req.body.password)) {
					return res.json(false);
				}

				res.json(clearUser(user));
			},
			'/sign': async (req, res) => {
				const userExists = await findUser(req.body.email, req.get('host'));

				if (userExists) {
					res.json(false);
				} else {

				}

				const user = new waw.User({
					reg_email: req.body.email.toLowerCase(),
					email: req.body.email.toLowerCase(),
					data: req.body.data || {},
					host: req.get('host'),
					is: {}
				});

				user.password = user.generateHash(req.body.password);

				await user.save();

				res.json(clearUser(user));
			}
		}
	});

	/* CRUD */
	const select = () => '-password -resetPin';
	waw.crud('user', {
		create: {
			ensure: waw.role('admin'),
			query: (req)=>{
				return {
					host: req.get('host')
				};
			}
		},
		get: {
			ensure: waw.next,
			query: (req) => {
				return {
					host: req.get('host')
				};
			},
			select
		},
		fetch: [{
			ensure: waw.next,
			query: (req) => {
				return {
					host: req.get('host'),
					_id: req.body._id
				}
			},
			select
		},{
			name: 'me',
			query: req => {
				return {
					_id: req.user._id
				}
			},
			select
		}],
		update: [{
			query: req => {
				return {
					_id: req.user._id
				}
			},
			select
		}, {
			name: 'admin',
			ensure: waw.role('admin'),
			query: req => {
				return {
					_id: req.body._id
				}
			},
			select
		}],
		delete: {
			name: 'admin',
			ensure: waw.role('admin'),
			query: req => {
				return {
					_id: req.body._id
				}
			},
			select
		}
	});
};
