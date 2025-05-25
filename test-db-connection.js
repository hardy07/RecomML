require("dotenv").config();
const connectDB = require("./config/database");

async function testConnection() {
  try {
    await connectDB();
    console.log("✅ Database connection successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
