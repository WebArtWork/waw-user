module.exports = async waw => {
	waw.crud('userfeature', {
		create: {
			ensure: waw.role('admin')
		},
		fetch: {
			ensure: waw.role('admin')
		},
		get: {
			ensure: waw.next,
			query: () => {
				return {};
			}
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
};
