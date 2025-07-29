/** .eslintrc.js at root level **/
module.exports = {
    root: true,
    env: {
      browser: true,
      es6: true,
      node: true,
    },
    extends: [
      "next/core-web-vitals",
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  };
  