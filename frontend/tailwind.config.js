module.exports = {
	content: ["./index.html", "./src/**/*.{ts,tsx}", "./src/styles/**/*.css"],
	darkMode: "media",
	theme: { extend: {} },
	plugins: [
        require('@tailwindcss/typography'), // Pour le style Markdown
    ],
};
