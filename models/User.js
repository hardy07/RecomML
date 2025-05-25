const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");

const userSchema = new mongoose.Schema(
  {
    spotifyId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      sparse: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenExpires: {
      type: Date,
      required: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt tokens before saving
userSchema.pre("save", function (next) {
  if (this.isModified("accessToken")) {
    this.accessToken = CryptoJS.AES.encrypt(
      this.accessToken,
      process.env.ENCRYPTION_KEY
    ).toString();
  }

  if (this.isModified("refreshToken")) {
    this.refreshToken = CryptoJS.AES.encrypt(
      this.refreshToken,
      process.env.ENCRYPTION_KEY
    ).toString();
  }

  next();
});

// Decrypt tokens when accessing
userSchema.methods.getDecryptedTokens = function () {
  const decryptedAccessToken = CryptoJS.AES.decrypt(
    this.accessToken,
    process.env.ENCRYPTION_KEY
  ).toString(CryptoJS.enc.Utf8);

  const decryptedRefreshToken = CryptoJS.AES.decrypt(
    this.refreshToken,
    process.env.ENCRYPTION_KEY
  ).toString(CryptoJS.enc.Utf8);

  return {
    accessToken: decryptedAccessToken,
    refreshToken: decryptedRefreshToken,
  };
};

module.exports = mongoose.model("User", userSchema);
