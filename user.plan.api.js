module.exports = async waw => {
	waw.crud('userplan', {
		create: {
			ensure: waw.role('admin')
		},
		get: {
			ensure: waw.next,
			query: ()=>{
				return {};
			}
		},
		fetch: {
			ensure: waw.role('admin')
		},
		update: {
			ensure: waw.role('admin'),
			query: req => {
				return {
					_id: req.body._id
				}
			}
		},
		delete: {
			ensure: waw.role('admin'),
			query: req => {
				return {
					_id: req.body._id
				}
			}
		}
	});
	await waw.wait(1000);

	waw.addJson('plans', async (store, fillJson)=>{
		fillJson.plans = await waw.Userplan.find({}).sort('order');
		fillJson.features = await waw.Userfeature.find({}).sort('order');
	});
};
