module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema({
		name: String,
		description: String,
		price: Number,
		yearPrice: Number,
		url: String,
		order: Number,
		data: {},
		author: {
			type: waw.mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		moderators: [
			{
				type: waw.mongoose.Schema.Types.ObjectId,
				sparse: true,
				ref: "User",
			},
		],
		inPlan: {}, // inPlan[plan._id] true when feature included in the plan
		inDone: {} // inDone[plan._id] true when feature working
	});

	Schema.methods.create = function (obj, user, waw) {
		this.author = user._id;

		this.moderators = [user._id];

		this.name = obj.name;

		this.order = obj.order;

		this.description = obj.description;

		this.data = obj.data;

		this.price = obj.price;

		this.yearPrice = obj.yearPrice;

		this.url = obj.url;

		this.inPlan = obj.inPlan;

		this.inDone = obj.inDone;
	};
	return (waw.Userfeature = waw.mongoose.model("Userfeature", Schema));
};
