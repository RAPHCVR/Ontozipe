module.exports = {
	parser: "@typescript-eslint/parser",
	extends: [
		"plugin:react/recommended",
		"plugin:@typescript-eslint/recommended",
	],
	settings: { react: { version: "detect" } },
	rules: { "react/react-in-jsx-scope": "off" },
};
