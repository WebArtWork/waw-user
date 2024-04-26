module.exports = function (waw) {
	if (!waw.config.ssls) {
		return;
	}
	const serve = (page, config) => {
		return (req, res) => {
			res.send(config.code);
		};
	};
	for (const ssl of waw.config.ssls) {
		const page = {};
		for (const config of ssl.configs) {
			page[config.url] = serve(page, config);
		}
		waw.api({
			domain: ssl.domain,
			page,
		});
	}
};
