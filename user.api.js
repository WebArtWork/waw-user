const { v4: uuidv4 } = require("uuid");
const path = require("path");
const nJwt = require("njwt");
module.exports = function (waw) {
	waw.transaction = waw.transaction || (() => {});
	/* remove support of waw.file */
	waw.file("user", {
		rename: (req) => req.user._id + ".jpg",
		ensure: waw.ensure,
		process: async (req, res) => {
			const user = await waw.User.findOne({
				_id: req.user._id,
			});

			user.thumb = req.files[0].url;

			await user.save();

			res.json(user.thumb);
		},
	});

	/*
	 *	User configuration
	 */
	if (!waw.config.signingKey) {
		waw.config.signingKey = uuidv4();

		let serverJson = waw.readJson(process.cwd() + "/server.json");

		serverJson.signingKey = waw.config.signingKey;

		waw.writeJson(process.cwd() + "/server.json", serverJson);
	}

	if (waw.config.mail) {
		const nodemailer = require("nodemailer");

		let transporter = nodemailer.createTransport({
			host: waw.config.mail.host,
			port: waw.config.mail.port,
			secure: waw.config.mail.secure,
			auth: waw.config.mail.auth,
		});

		waw.send = (opts, cb = (resp) => {}) => {
			transporter.sendMail(
				{
					from: waw.config.mail.from,
					subject: opts.subject || waw.config.mail.subject,
					to: opts.to,
					text: opts.text,
					html: opts.html,
				},
				cb
			);
		};
	} else {
		waw.send = () => {};
	}

	const set_is = async (email, is) => {
		await waw.wait(300);

		const users = await waw.User.find({
			email: email,
		});

		for (const user of users) {
			if (!user) continue;

			if (!user.is) user.is = {};

			user.is[is] = true;

			user.markModified("is");

			await user.save();
		}
	};

	if (waw.config.user && waw.config.user.is) {
		for (const is in waw.config.user.is) {
			const emails = waw.config.user.is[is].split(" ");

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
						res.set("remove", "token");
						res.set("Access-Control-Expose-Headers", "field");
						next();
					} else {
						req.user = verifiedJwt.body;
						next();
					}
				}
			);
		} else next();
	});

	const clearUser = (user) => {
		user = JSON.parse(JSON.stringify(user));

		delete user.password;

		delete user.resetPin;

		user.token = nJwt.create(user, waw.config.signingKey);

		user.token.setExpiration(new Date().getTime() + 48 * 60 * 60 * 1000);

		user.token = user.token.compact();

		return user;
	};

	const findUser = async (email, host) => {
		return await waw.User.findOne({
			host,
			$or: [
				{
					reg_email: email.toLowerCase(),
				},
				{
					email: email.toLowerCase(),
				},
			],
		});
	};

	const new_pin = async (user, cb = () => {}) => {
		user.resetPin = (
			Math.floor(Math.random() * (999999 - 100000)) + 100000
		).toString();

		console.log(user.resetPin);

		user.markModified("data");

		await user.save();

		waw.send(
			{
				to: user.email,
				subject: "Code: " + user.resetPin,
				html: "Code: " + user.resetPin,
			},
			cb
		);
	};

	waw.setUserPlan = async (transaction) => {
		const user = await waw.User.findById(transaction.author);
		console.log(user.plan, user.features);
		if (transaction.plan) {
			user.plan = transaction.plan;
			user.markModified("plan");
		}
		user.features = transaction.features.concat(user.features || []);
			// .filter((value, index, self) => {
			// 	return self.indexOf(value) === index;
			// });
		user.markModified("features");
		user.is = user.is || {};
		user.is.owner = true;
		user.markModified("is");
		console.log(user.plan, user.features);
		await user.save();
	};

	const featuresHandle = async (req, res) => {
		const user = await waw.User.findById(req.user._id);
		if (user.features.length) {
			req.body.plan = "";
		}
		if (!req.body.plan) {
			for (const featureId of req.body.features) {
				if (user.features.includes(featureId)) {
					req.body.features.splice(
						req.body.features.findIndex((f) => f === featureId),
						1
					);
				}
			}
		}
		const features = await waw.Userfeature.find(
			req.body.plan
				? {}
				: {
						_id: req.body.features,
				  }
		);
		if (req.body.plan) {
			for (const feature of features) {
				if (!feature.inPlan || !feature.inPlan[req.body.plan]) {
					features.splice(
						features.findIndex((f) => f.id === feature.id),
						1
					);
				}
			}
		}
		const plan = req.body.plan
			? await waw.Userplan.findById(req.body.plan)
			: null;

		if (!features.length || (user.plan && req.body.plan)) {
			return res.json(false);
		}

		const amount =
			(plan
				? plan.price
				: features
						.map((f) => f.price)
						.reduce((a, v) => Number(a) + Number(v)) || 0) * 100;
		if (!amount) {
			return res.json(false);
		}
		const names = features
			.map((f) => f.name)
			.reduce((a, v) => v + (v ? ", " : "") + a);

		const order_desc =
			req.body.language === "uk"
				? `Купуємо ${features.length ? "функції" : "функцію"} ${names}${
						plan ? " від плану " + plan.name : ""
				  }`
				: req.body.language === "fr"
				? `Nous achetons ${
						features.length ? "caractéristiques" : "caractéristique"
				  } ${names}${plan ? " du plan " + plan.name : ""}`
				: `We buy ${features.length ? "features" : "feature"} ${names}${
						plan ? " from plan " + plan.name : ""
				  }`;

		waw.transaction(
			{
				order_desc,
				amount,
				// recurring_data: {
				// 	every: 1,
				// 	period: "month",
				// 	amount,
				// 	start_time: new Date(),
				// 	state: "y",
				// 	Readonly: "n",
				// },
			},
			(resp) => {
				res.json(resp.checkout_url);
			},
			(err) => {
				console.log(err);
				res.json(false);
			},
			{
				author: req.user._id,
				plan: plan ? plan._id : null,
				features: features.map((f) => f._id),
			}
		);
	};

	waw.api({
		router: "/api/user",
		get: {
			"/config": async (req, res) => {
				res.json({
					languages: waw.config.languages,
					currency: waw.config.currency,
					ip: waw.config.store.ip
				});
			},
		},
		post: {
			"/features": async (req, res) => {
				if (req.user) {
					featuresHandle(req, res);
				} else {
					res.json(false);
				}
			},
			"/status": async (req, res) => {
				const user = await findUser(req.body.email, req.get("host"));

				const json = {};

				json.email = !!user;

				if (user && req.body.password) {
					json.pass = user.validPassword(req.body.password);
				}

				res.json(json);
			},
			"/request": async (req, res) => {
				const user = await findUser(req.body.email, req.get("host"));

				if (user) {
					new_pin(user);
				}

				res.json(true);
			},
			"/change": async (req, res) => {
				const user = await findUser(req.body.email, req.get("host"));

				if (user && user.resetPin === req.body.code) {
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
			"/login": async (req, res) => {
				const user = await findUser(req.body.email, req.get("host"));

				if (!user || !user.validPassword(req.body.password)) {
					return res.json(false);
				}

				res.json(clearUser(user));
			},
			"/sign": async (req, res) => {
				const userExists = await findUser(
					req.body.email,
					req.get("host")
				);

				if (userExists) {
					res.json(false);
				} else {
				}

				const user = new waw.User({
					reg_email: req.body.email.toLowerCase(),
					email: req.body.email.toLowerCase(),
					data: req.body.data || {},
					host: req.get("host"),
					is: {},
				});

				user.password = user.generateHash(req.body.password);

				await user.save();

				res.json(clearUser(user));
			},
		},
	});

	/* CRUD */
	const select = () => "-password -resetPin";
	waw.crud("user", {
		create: {
			ensure: waw.role("admin"),
			query: (req) => {
				return {
					host: req.get("host"),
				};
			},
		},
		get: {
			ensure: waw.next,
			query: (req) => {
				return {
					host: req.get("host"),
				};
			},
			select,
		},
		fetch: [
			{
				ensure: waw.next,
				query: (req) => {
					return {
						host: req.get("host"),
						_id: req.body._id,
					};
				},
				select,
			},
			{
				name: "me",
				query: (req) => {
					return {
						_id: req.user._id,
					};
				},
				select,
			},
		],
		update: [
			{
				query: (req) => {
					return {
						_id: req.user._id,
					};
				},
				select,
			},
			{
				name: "admin",
				ensure: waw.role("admin"),
				query: (req) => {
					return {
						_id: req.body._id,
					};
				},
				select,
			},
		],
		delete: {
			name: "admin",
			ensure: waw.role("admin"),
			query: (req) => {
				return {
					_id: req.body._id,
				};
			},
			select,
		},
	});
};
