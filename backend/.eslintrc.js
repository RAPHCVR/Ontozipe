module.exports = {
	parser: "@typescript-eslint/parser",
	extends: ["plugin:@typescript-eslint/recommended"],
	env: { node: true, jest: true },
	rules: { "no-console": "warn" },
};
