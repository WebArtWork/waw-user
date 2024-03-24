module.exports = async function (waw) {
	const Schema = waw.mongoose.Schema({
		name: String,
		description: String,
		price: Number,
		yearPrice: Number,
		order: Number,
		url: { type: String, sparse: true, trim: true, unique: true },
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
	});

	Schema.methods.create = function (obj, user, waw) {
		this.author = user._id;

		this.moderators = [user._id];

		this.order = obj.order;

		this.name = obj.name;

		this.description = obj.description;

		this.price = obj.price;

		this.yearPrice = obj.yearPrice;

		this.data = obj.data;

		this.url = obj.url;
	};
	return (waw.Userplan = waw.mongoose.model("Userplan", Schema));
};
