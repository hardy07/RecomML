const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Ensure the dist directory exists
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

console.log("Building frontend...");
execSync("npm run build", { stdio: "inherit" });

console.log("Setup complete! You can now run:");
console.log("npm start");
