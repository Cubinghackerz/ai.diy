import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";

export default [
    {
        ignores: [
            "node_modules/**",
            "build/**",
            ".react-router/**",
            "test-results/**",
            "playwright-report/**",
        ],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { "react-hooks": hooks, "jsx-a11y": a11y },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            ...a11y.configs.recommended.rules,
        },
    },
];
